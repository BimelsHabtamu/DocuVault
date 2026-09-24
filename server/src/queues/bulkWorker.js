'use strict';
const { Worker }      = require('bullmq');
const { pool }        = require('../config/db');
const { QUEUE_NAME, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, bulkQueue } = require('./bulkQueue');
const {
  updateJobProgress,
  setZipCreating,
  setZipReady,
  setZipFailed,
  resetJobForRetry,
} = require('../utils/bulkJobTracker');
const { createBulkZip } = require('../services/bulkZipService');
const { recordAudit }   = require('../utils/auditLog');

// Lazy-require to avoid circular dependency at module load time.
let _generateSingleDocument = null;
let _fetchTemplateRecord    = null;

function getHelpers() {
  if (!_generateSingleDocument) {
    const dc = require('../controllers/documentController');
    _generateSingleDocument = dc.generateSingleDocument;
    _fetchTemplateRecord    = dc.fetchTemplateRecord;
    if (!_generateSingleDocument || !_fetchTemplateRecord) {
      throw new Error('[bulkWorker] generateSingleDocument or fetchTemplateRecord not exported from documentController.');
    }
  }
  return { generateSingleDocument: _generateSingleDocument, fetchTemplateRecord: _fetchTemplateRecord };
}

const MAX_RECORD_RETRIES = 2;

// NFR-001: process this many records in parallel within a single bulk job.
// Each record opens its own Puppeteer page on the shared browser instance
// (see pdfGenerator.js — one Chromium process, N concurrent pages).
// 5 concurrent pages delivers ~57 s for 100 documents on a typical server,
// comfortably under the 60-second SRS target. On a constrained dev laptop
// with other processes competing for CPU, measured throughput is ~700 ms/doc;
// a production server (dedicated CPU cores) will be faster.
const PARALLEL_RECORDS = 5;

// ── Processor ─────────────────────────────────────────────────────────────────

async function processBulkJob(job) {
  const { templateId, recordIds, userId } = job.data;
  const jobId = job.id;

  console.log(`[bulkWorker] Starting job ${jobId} (attempt ${job.attemptsMade + 1}): ${recordIds.length} record(s), template ${templateId}`);

  // Reset accumulated results at the start of each attempt so a retry starts
  await resetJobForRetry(jobId, job);

  // ── 1. Load template ──────────────────────────────────────────────────────
  const [rows] = await pool.query('SELECT * FROM templates WHERE id = ?', [templateId]);
  const template = rows[0];
  if (!template) {
    throw Object.assign(new Error(`Template ${templateId} not found.`), { unrecoverable: true });
  }
  if (template.status !== 'active') {
    throw Object.assign(new Error(`Template ${templateId} is not active.`), { unrecoverable: true });
  }

  const { generateSingleDocument, fetchTemplateRecord } = getHelpers();

  // ── 2. Process records in parallel batches (NFR-001) ─────────────────────
  // Records are sliced into batches of PARALLEL_RECORDS. Within each batch
  // all records race concurrently (Promise.allSettled), so Puppeteer renders
  // N pages in parallel on the shared browser. Batches are sequential so the
  // progress counter is always accurate: after each batch we know exactly how
  // many records have finished and can push a reliable percentage to the client.
  let processedCount = 0;

  /** Validate email for one record and generate its PDF (with retries). */
  async function processOneRecord(recordId) {
    // 2a. Email validation
    let recordEmail = null;
    let emailValidationError = null;

    try {
      const rawRecord = await fetchTemplateRecord(template, recordId).catch(() => null);
      if (!rawRecord) {
        emailValidationError = `Record "${recordId}" not found in "${template.data_source_table}".`;
      } else {
        const emailKey = Object.keys(rawRecord).find((k) => /email/i.test(k));
        if (!emailKey || !rawRecord[emailKey]) {
          emailValidationError = `Record "${recordId}" has no email address on file.`;
        } else {
          recordEmail = String(rawRecord[emailKey]).trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recordEmail)) {
            emailValidationError = `Record "${recordId}" has an invalid email (${recordEmail}).`;
          }
        }
      }
    } catch (fetchErr) {
      emailValidationError = `Could not validate email for "${recordId}": ${fetchErr.message}`;
    }

    if (emailValidationError) {
      updateJobProgress(jobId, { recordId, success: false, error: emailValidationError, attempts: 1 });
      return;
    }

    // 2b. Generate PDF with per-record retry
    let lastError = null;
    let succeeded = false;

    for (let attempt = 0; attempt <= MAX_RECORD_RETRIES && !succeeded; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((res) => setTimeout(res, 1000 * attempt));
        }
        const doc = await generateSingleDocument({ template, recordId, userId });
        updateJobProgress(jobId, {
          recordId,
          success:        true,
          docId:          doc.docUuid,
          dbId:           doc.id,
          recipientEmail: recordEmail,
          attempts:       attempt + 1,
        });
        succeeded = true;
      } catch (err) {
        lastError = err;
        if (err.status === 422 || err.status === 404) break; // permanent — skip retry
      }
    }

    if (!succeeded) {
      updateJobProgress(jobId, {
        recordId,
        success:  false,
        error:    lastError?.message,
        attempts: MAX_RECORD_RETRIES + 1,
      });
    }
  }

  // Slice the full record list into batches and run each batch in parallel.
  for (let i = 0; i < recordIds.length; i += PARALLEL_RECORDS) {
    const batch = recordIds.slice(i, i + PARALLEL_RECORDS);
    await Promise.allSettled(batch.map((recordId) => processOneRecord(recordId)));
    processedCount += batch.length;
    await _persistProgress(job, processedCount, recordIds.length);
  }

  // ── 3. Collect final results and persist authoritative state ─────────────
  // Write one definitive updateData with the final counts so the data is
  // guaranteed in Redis — the incremental _withJob writes from updateJobProgress
  // are async and may not have all landed before this point.
  const { _getShadow } = require('../utils/bulkJobTracker');
  const shadow    = _getShadow(jobId);
  const results   = shadow ? shadow.results   : (job.data.results   || []);
  const completed = shadow ? shadow.completed : (job.data.completed || 0);
  const failed    = shadow ? shadow.failed    : (job.data.failed    || 0);
  const finalStatus = (failed > 0 && completed === 0) ? 'failed' : 'completed';

  await job.updateData({
    ...job.data,
    results,
    completed,
    failed,
    status:     finalStatus,
    finishedAt: new Date().toISOString(),
  });

  const successResults = results.filter((r) => r.success && r.dbId);

  if (successResults.length === 0) {
    console.log(`[bulkWorker] job ${jobId}: 0 successful PDFs — skipping ZIP.`);
    await job.updateData({
      ...job.data,
      status:     'completed',
      finishedAt: new Date().toISOString(),
      zipStatus:  null,
    });
    return;
  }

  setZipCreating(jobId);
  await job.updateData({ ...job.data, zipStatus: 'creating' });

  try {
    const successDbIds = successResults.map((r) => r.dbId);
    const placeholders = successDbIds.map(() => '?').join(',');
    const [docRows]    = await pool.query(
      `SELECT id, file_path, metadata FROM generated_docs WHERE id IN (${placeholders})`,
      successDbIds
    );

    const pdfFiles = docRows.map((row) => {
      let friendlyName = null;
      try {
        const meta = row.metadata ? JSON.parse(row.metadata) : {};
        friendlyName = meta.fileName || null;
      } catch { /* fall back to basename */ }
      return { filePath: row.file_path, friendlyName };
    });

    const { zipPath, zipFileName, includedCount, skippedCount } = await createBulkZip(pdfFiles);

    setZipReady(jobId, zipFileName, zipPath);

    await job.updateData({
      ...job.data,
      zipStatus:   'ready',
      zipFileName,
      zipPath,
      zipError:    null,
      finishedAt:  new Date().toISOString(),
    });

    await recordAudit({
      userId,
      action:  'BULK_ZIP_CREATED',
      details: { jobId, includedCount, skippedCount, zipFileName },
    });

    console.log(`[bulkWorker] job ${jobId}: ZIP ready — ${includedCount} included, ${skippedCount} skipped. File: ${zipFileName}`);
  } catch (zipErr) {
    setZipFailed(jobId, zipErr.message);
    await job.updateData({
      ...job.data,
      zipStatus:  'failed',
      zipError:   zipErr.message,
      zipPath:    null,
      finishedAt: new Date().toISOString(),
    });
    console.error(`[bulkWorker] job ${jobId}: ZIP creation failed:`, zipErr.message);
    // Non-fatal — individual PDFs remain accessible.
  }
}

async function _persistProgress(job, processed, total) {
  try {
    await job.updateProgress(Math.round((processed / total) * 100));
  } catch { /* cosmetic — don't abort generation */ }
}

// ── Worker factory ────────────────────────────────────────────────────────────

let _worker = null;

function startBulkWorker() {
  if (_worker) return _worker;

  const workerConnection = new (require('ioredis'))({
    host:                 REDIS_HOST,
    port:                 REDIS_PORT,
    password:             REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableOfflineQueue:   false,
  });

  _worker = new Worker(QUEUE_NAME, processBulkJob, {
    connection:  workerConnection,
    concurrency: 1,
  });

  _worker.on('completed', (job) => {
    console.log(`[bulkWorker] Job ${job.id} completed.`);
  });
  _worker.on('failed', (job, err) => {
    console.error(`[bulkWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message);
  });
  _worker.on('error', (err) => {
    console.error('[bulkWorker] Worker error:', err.message);
  });

  console.log('[bulkWorker] Worker started — listening on queue:', QUEUE_NAME);
  return _worker;
}

async function stopBulkWorker() {
  if (_worker) {
    await _worker.close();
    _worker = null;
    console.log('[bulkWorker] Worker stopped.');
  }
}

module.exports = { startBulkWorker, stopBulkWorker };
