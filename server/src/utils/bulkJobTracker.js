'use strict';

/**
 * bulkJobTracker.js  (Stage 2 — BullMQ + Redis)
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides the exact same public API as the Stage 1 in-memory version so that
 * documentController and bulkWorker call the same functions without change:
 *
 *   createJob(total, userId)            → jobId string
 *   updateJobProgress(jobId, entry)     → void
 *   setZipCreating(jobId)               → void
 *   setZipReady(jobId, fileName, path)  → void
 *   setZipFailed(jobId, msg)            → void
 *   getJob(jobId)                       → job-shape object | null
 *   toClientShape(job)                  → job-shape without zipPath
 *
 * How state is stored
 * ────────────────────
 * BullMQ persists job data in Redis as JSON under the key
 *   bull:bulk-pdf-generation:<jobId>
 *
 * The full job-shape object is stored in job.data.  Every mutating function
 * (updateJobProgress, setZipCreating, etc.) reads the current BullMQ job,
 * updates the relevant fields, and writes them back with job.updateData().
 *
 * createJob() enqueues the job in Redis (via bulkQueue) and returns the jobId
 * so documentController can respond 202 immediately — the Worker picks it up
 * asynchronously.
 *
 * getJob() fetches the BullMQ job from Redis and reconstructs the same flat
 * shape that the old Map stored, so getBulkStatus and downloadBulkZip work
 * without modification.
 *
 * Restart recovery
 * ────────────────
 * Because all state lives in Redis, a server restart does NOT lose job progress.
 * In-flight jobs are resumed by the Worker on reconnect; completed/failed jobs
 * remain readable for 7 days (completed) / 30 days (failed) per queue config.
 *
 * Thread safety note
 * ──────────────────
 * updateJobProgress() uses optimistic in-memory accumulation then writes back to
 * Redis.  Since concurrency=1 (one job at a time, one record at a time), there
 * is no race condition in practice.  A future multi-worker upgrade would need
 * Redis atomic operations (HINCRBY / Lua scripts) here.
 */

const { Queue }    = require('bullmq');
const { bulkQueue, redisConnection, QUEUE_NAME } = require('../queues/bulkQueue');

// ── In-memory accumulator ─────────────────────────────────────────────────────
// BullMQ job.data updates are async (network round-trip).  We keep a lightweight
// in-memory shadow of the mutable per-record fields so the worker loop can call
// updateJobProgress() synchronously and flush to Redis periodically.
// getJob() always reads from Redis (authoritative) — the shadow is write-only.
const _shadow = new Map(); // jobId -> { completed, failed, results[] }

// ── resetJobForRetry ──────────────────────────────────────────────────────────

/**
 * Called at the start of each BullMQ retry attempt to reset accumulated results.
 * Without this, results[] and counters from a previous failed attempt stack up,
 * causing completed+failed to exceed total.
 *
 * Resets both the in-memory shadow and the Redis job.data so the new attempt
 * starts from a clean slate.
 *
 * @param {string} jobId
 * @param {import('bullmq').Job} bullJob  — the live BullMQ job object
 */
async function resetJobForRetry(jobId, bullJob) {
  // Reset in-memory shadow
  _shadow.set(jobId, { completed: 0, failed: 0, results: [] });

  // Reset Redis state
  try {
    await bullJob.updateData({
      ...bullJob.data,
      completed:  0,
      failed:     0,
      results:    [],
      status:     'running',
      finishedAt: null,
      zipStatus:  null,
      zipFileName: null,
      zipPath:    null,
      zipError:   null,
    });
  } catch (err) {
    console.warn(`[bulkJobTracker] resetJobForRetry failed for ${jobId}:`, err.message);
  }
}

// ── createJob ─────────────────────────────────────────────────────────────────

/**
 * Enqueues a new bulk generation job in the BullMQ Redis queue and returns
 * the job ID immediately (202 response pattern).
 *
 * The job payload stored in Redis:
 *   templateId, recordIds, userId  — inputs for the Worker
 *   total, completed, failed       — progress counters
 *   status                         — running | completed | failed
 *   results                        — per-record outcomes
 *   startedAt, finishedAt          — timestamps
 *   zipStatus, zipFileName, zipPath, zipError  — ZIP fields
 *   createdBy                      — authz for download endpoint
 *
 * @param {number} total
 * @param {number} userId
 * @param {object} jobPayload  — { templateId, recordIds } from generateBulkDocuments
 * @returns {string} jobId
 */
async function createJob(total, userId, jobPayload = {}) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const initialData = {
    // Worker inputs
    templateId: jobPayload.templateId || null,
    recordIds:  jobPayload.recordIds  || [],
    userId,
    // Progress state (mirrors old Map shape exactly)
    jobId,
    total,
    completed:   0,
    failed:      0,
    status:      'running',
    results:     [],
    startedAt:   new Date().toISOString(),
    finishedAt:  null,
    // ZIP fields
    zipStatus:   null,
    zipFileName: null,
    zipPath:     null,
    zipError:    null,
    createdBy:   userId || null,
  };

  // Enqueue with a custom jobId so poll endpoint and download endpoint can look
  // it up by the same ID string we return to the frontend.
  await bulkQueue.add('generate-bulk', initialData, { jobId });

  // Initialise in-memory shadow
  _shadow.set(jobId, { completed: 0, failed: 0, results: [] });

  return jobId;
}

// ── _withJob helper ───────────────────────────────────────────────────────────

/**
 * Fetches the BullMQ job, applies a synchronous mutator to job.data, and
 * writes the updated data back to Redis.  Used by all state-mutation functions.
 * Never throws — a Redis write failure is logged but must not crash generation.
 */
async function _withJob(jobId, mutator) {
  try {
    const job = await Queue.prototype.getJob
      ? (await _getQueue().getJob(jobId))
      : null;
    if (!job) {
      console.warn(`[bulkJobTracker] _withJob: job ${jobId} not found in Redis.`);
      return;
    }
    const updated = mutator({ ...job.data });
    await job.updateData(updated);
  } catch (err) {
    console.error(`[bulkJobTracker] _withJob error for job ${jobId}:`, err.message);
  }
}

/** Returns the shared Queue instance (lazy so circular require resolves). */
function _getQueue() {
  return bulkQueue;
}

// ── updateJobProgress ─────────────────────────────────────────────────────────

/**
 * Records one record's outcome.  Updates the in-memory shadow synchronously
 * (for the worker loop's running totals) then persists to Redis.
 *
 * @param {string} jobId
 * @param {{ recordId, success, docId?, dbId?, error?, attempts? }} resultEntry
 */
function updateJobProgress(jobId, resultEntry) {
  // Update shadow synchronously
  const shadow = _shadow.get(jobId);
  if (shadow) {
    shadow.results.push(resultEntry);
    if (resultEntry.success) shadow.completed += 1;
    else shadow.failed += 1;
  }

  // Persist to Redis asynchronously (fire-and-forget — caller must not await)
  _withJob(jobId, (data) => {
    const results   = [...(data.results || []), resultEntry];
    const completed = results.filter((r) => r.success).length;
    const failed    = results.filter((r) => !r.success).length;
    const done      = completed + failed >= data.total;
    return {
      ...data,
      results,
      completed,
      failed,
      status:     done ? (failed > 0 && completed === 0 ? 'failed' : 'completed') : 'running',
      finishedAt: done ? new Date().toISOString() : null,
    };
  });
}

// ── ZIP state setters ─────────────────────────────────────────────────────────

function setZipCreating(jobId) {
  // Update shadow immediately so the worker's in-process reads are consistent
  const shadow = _shadow.get(jobId);
  if (shadow) shadow.zipStatus = 'creating';

  _withJob(jobId, (data) => ({ ...data, zipStatus: 'creating' }));
}

function setZipReady(jobId, zipFileName, zipPath) {
  const shadow = _shadow.get(jobId);
  if (shadow) { shadow.zipStatus = 'ready'; shadow.zipFileName = zipFileName; shadow.zipPath = zipPath; }

  _withJob(jobId, (data) => ({
    ...data,
    zipStatus:   'ready',
    zipFileName,
    zipPath,
    zipError:    null,
  }));
}

function setZipFailed(jobId, errorMessage) {
  const shadow = _shadow.get(jobId);
  if (shadow) { shadow.zipStatus = 'failed'; shadow.zipError = errorMessage; }

  _withJob(jobId, (data) => ({
    ...data,
    zipStatus:   'failed',
    zipFileName: null,
    zipPath:     null,
    zipError:    errorMessage || 'ZIP creation failed.',
  }));
}

// ── getJob ────────────────────────────────────────────────────────────────────

/**
 * Reads the job from Redis and returns the same flat shape the old Map returned.
 * Returns null if the job doesn't exist or Redis is unavailable.
 *
 * This is the authoritative source — always reads from Redis so the state is
 * correct after a server restart.
 *
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
async function getJob(jobId) {
  try {
    const job = await _getQueue().getJob(jobId);
    if (!job) return null;

    const d = job.data || {};

    // Merge in-memory shadow for the most up-to-date running counters
    // (Redis writes are async so the shadow may be fractionally ahead).
    const shadow = _shadow.get(jobId);
    const completed = shadow ? shadow.completed : (d.completed || 0);
    const failed    = shadow ? shadow.failed    : (d.failed    || 0);
    const total     = d.total || 0;

    // Derive status from counters when all records are accounted for.
    // This covers two cases:
    //   1. Shadow is present (in-process) — counters are ahead of Redis writes
    //   2. Shadow is absent (after restart) — use Redis d.completed/d.failed/d.total
    // In both cases, if counts show all records done, override the Redis status field
    // which may still say 'running' because the async _withJob write hasn't landed.
    let status = d.status || 'running';
    if (status === 'running' && total > 0 && (completed + failed) >= total) {
      status = (failed > 0 && completed === 0) ? 'failed' : 'completed';
    }
    // After restart: also derive from Redis fields directly (no shadow)
    if (!shadow && status === 'running') {
      const redisCompleted = d.completed || 0;
      const redisFailed    = d.failed    || 0;
      if (total > 0 && (redisCompleted + redisFailed) >= total) {
        status = (redisFailed > 0 && redisCompleted === 0) ? 'failed' : 'completed';
      }
    }

    // ZIP state: prefer shadow (written synchronously) over Redis (async write)
    const zipStatus   = shadow?.zipStatus   !== undefined ? shadow.zipStatus   : (d.zipStatus   ?? null);
    const zipFileName = shadow?.zipFileName !== undefined ? shadow.zipFileName : (d.zipFileName ?? null);
    const zipPath     = shadow?.zipPath     !== undefined ? shadow.zipPath     : (d.zipPath     ?? null);
    const zipError    = shadow?.zipError    !== undefined ? shadow.zipError    : (d.zipError    ?? null);

    return {
      jobId:       d.jobId       || jobId,
      total,
      completed,
      failed,
      status,
      results:     shadow ? shadow.results   : (d.results   || []),
      startedAt:   d.startedAt   || null,
      finishedAt:  d.finishedAt  || null,
      zipStatus,
      zipFileName,
      zipPath,
      zipError,
      createdBy:   d.createdBy   || null,
    };
  } catch (err) {
    console.error(`[bulkJobTracker] getJob error for ${jobId}:`, err.message);
    return null;
  }
}

// ── toClientShape ─────────────────────────────────────────────────────────────

/**
 * Strips the internal zipPath before sending to the client.
 * Identical contract to the Stage 1 version.
 */
function toClientShape(job) {
  if (!job) return null;
  // eslint-disable-next-line no-unused-vars
  const { zipPath, ...rest } = job;
  return rest;
}

/** Expose the shadow map for the worker to read final counts directly. */
function _getShadow(jobId) {
  return _shadow.get(jobId) || null;
}

module.exports = {
  createJob,
  updateJobProgress,
  setZipCreating,
  setZipReady,
  setZipFailed,
  getJob,
  toClientShape,
  resetJobForRetry,
  _getShadow,
};
