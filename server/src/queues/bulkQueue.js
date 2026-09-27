'use strict';
const { Queue } = require('bullmq');
const Redis     = require('ioredis');
require('dotenv').config();

// ── Redis connection options ──────────────────────────────────────────────────

/**
 * Two ways to point at Redis, in priority order:
 *
 *  1. REDIS_URL — a full connection string, e.g.
 *       redis://:password@host:6379        (plain)
 *       rediss://:password@host:6379       (TLS)
 *     This is what managed providers hand out. Render Key Value, Railway, Upstash
 *     and Aiven all give you exactly this string and nothing else, so splitting
 *     host/port/password out of it by hand is needless work.
 *
 *  2. REDIS_HOST / REDIS_PORT / REDIS_PASSWORD — the local-development form,
 *     kept for XAMPP/Memurai/portable-Redis setups where there is no URL.
 *
 * REDIS_TLS=true forces TLS when using form 2 (a managed instance reached by
 * hostname rather than its internal address).
 */
const REDIS_URL = process.env.REDIS_URL || '';

function buildConnectionOptions(extra = {}) {
  if (REDIS_URL) {
    return { ...extra };
  }
  const options = {
    host:   process.env.REDIS_HOST     || '127.0.0.1',
    port:   Number(process.env.REDIS_PORT) || 6379,
    ...extra,
  };
  if (process.env.REDIS_PASSWORD) options.password = process.env.REDIS_PASSWORD;
  if (/^(1|true|yes|on)$/i.test(String(process.env.REDIS_TLS || ''))) {
    options.tls = { rejectUnauthorized: false };
  }
  return options;
}

const REDIS_HOST = REDIS_URL
  ? (() => { try { return new URL(REDIS_URL).hostname; } catch { return 'REDIS_URL'; } })()
  : (process.env.REDIS_HOST || '127.0.0.1');
const REDIS_PORT = REDIS_URL
  ? (() => { try { return new URL(REDIS_URL).port || 6379; } catch { return 6379; } })()
  : (Number(process.env.REDIS_PORT) || 6379);

const redisConnection = new Redis(buildConnectionOptions({
  // BullMQ requirement: BullMQ commands must not time out while a job is running.
  maxRetriesPerRequest: null,
  enableOfflineQueue:   false,  // fail fast when Redis is unavailable
}));

redisConnection.on('error', (err) => {
  // Log but don't crash — ioredis will retry; we handle the "permanently down"
  // case in checkRedisReachable() at boot.
  console.error('[redis] Connection error:', err.message);
});

// ── BullMQ Queue ──────────────────────────────────────────────────────────────

const QUEUE_NAME = 'bulk-pdf-generation';


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

async function checkRedisReachable() {
  const probe = new Redis(buildConnectionOptions({
    maxRetriesPerRequest: 1,
    connectTimeout:       5000,
    lazyConnect:          true,
  }));
  try {
    await probe.connect();
    const pong = await probe.ping();
    if (pong !== 'PONG') throw new Error(`Unexpected PING response: ${pong}`);
    console.log(`[redis] Connected to ${REDIS_HOST}:${REDIS_PORT} ✅`);
  } catch (err) {
    throw new Error(
      `[redis] Cannot reach Redis at ${REDIS_HOST}:${REDIS_PORT} — ${err.message}\n` +
      `  The server refuses to start without Redis because bulk PDF generation (FR-019) needs it.\n` +
      `  Local dev: run start-dev.ps1 (starts the Memurai service), or\n` +
      `             Start-Process "C:\\Users\\HP\\redis5-portable\\redis-server.exe" -ArgumentList "--port 6379"\n` +
      `  Production: set REDIS_URL to your provider's connection string, or REDIS_HOST / REDIS_PORT / REDIS_PASSWORD.`
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
