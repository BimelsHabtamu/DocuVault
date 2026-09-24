'use strict';
const { Queue } = require('bullmq');
const Redis     = require('ioredis');
require('dotenv').config();

// ── Redis connection options ──────────────────────────────────────────────────

const REDIS_HOST     = process.env.REDIS_HOST     || '127.0.0.1';
const REDIS_PORT     = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

/**
 * Shared ioredis connection used by the Queue (producer) and bulkJobTracker.
 * enableOfflineQueue: false — if Redis goes down mid-run, commands fail fast
 * instead of silently queuing in memory forever.
 * maxRetriesPerRequest: null — required by BullMQ; it handles its own retry logic.
 */
const redisConnection = new Redis({
  host:                 REDIS_HOST,
  port:                 REDIS_PORT,
  password:             REDIS_PASSWORD,
  maxRetriesPerRequest: null,   // required by BullMQ
  enableOfflineQueue:   false,  // fail fast when Redis is unavailable
});

redisConnection.on('error', (err) => {
  // Log but don't crash — ioredis will retry; we handle the "permanently down"
  // case in checkRedisReachable() at boot.
  console.error('[redis] Connection error:', err.message);
});

// ── BullMQ Queue ──────────────────────────────────────────────────────────────

const QUEUE_NAME = 'bulk-pdf-generation';

/**
 * The BullMQ Queue instance (producer side).
 * defaultJobOptions:
 *   attempts: 3          — job-level retries for transient failures (NFR-004)
 *   backoff: exponential — 2s → 4s → 8s between retries
 *   removeOnComplete: { age: 86400 * 7 }  — keep completed jobs 7 days for polling
 *   removeOnFail:     { age: 86400 * 30 } — keep failed jobs 30 days for audit
 */
const bulkQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type:  'exponential',
      delay: 2000, // 2 s → 4 s → 8 s
    },
    removeOnComplete: { age: 86400 * 7  },  // 7 days
    removeOnFail:     { age: 86400 * 30 },  // 30 days
  },
});

// ── Boot-time health check ────────────────────────────────────────────────────

/**
 * Attempts a real TCP + Redis PING to confirm Redis is reachable.
 * Called once from server.js before the HTTP server starts.
 * Uses a short-lived dedicated connection so it never conflicts with the
 * shared pool connection's own connection lifecycle.
 * Throws with a descriptive message if Redis cannot be reached.
 *
 * @returns {Promise<void>}
 */
async function checkRedisReachable() {
  const probe = new Redis({
    host:                 REDIS_HOST,
    port:                 REDIS_PORT,
    password:             REDIS_PASSWORD,
    maxRetriesPerRequest: 1,
    connectTimeout:       5000,
    lazyConnect:          true,
  });
  try {
    await probe.connect();
    const pong = await probe.ping();
    if (pong !== 'PONG') throw new Error(`Unexpected PING response: ${pong}`);
    console.log(`[redis] Connected to ${REDIS_HOST}:${REDIS_PORT} ✅`);
  } catch (err) {
    throw new Error(
      `[redis] Cannot reach Redis at ${REDIS_HOST}:${REDIS_PORT} — ${err.message}\n` +
      `  Make sure Redis is running before starting the server.\n` +
      `  Local dev: Start-Process "C:\\Users\\HP\\redis-portable\\redis-server.exe" -ArgumentList "--port 6379"\n` +
      `  Or set REDIS_HOST / REDIS_PORT / REDIS_PASSWORD in .env`
    );
  } finally {
    probe.disconnect();
  }
}

module.exports = {
  bulkQueue,
  redisConnection,
  QUEUE_NAME,
  REDIS_HOST,
  REDIS_PORT,
  checkRedisReachable,
};
