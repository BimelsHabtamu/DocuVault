/**
 * FR-026: e-sign timestamps must be NTP-synced for legal defensibility.
 *
 * `ntp-client` is an explicit dependency in package.json (not optional).
 * If the NTP query fails (network unreachable, firewall, timeout), the module
 * falls back to the system clock and sets source='system_clock_fallback' — the
 * caller can log this so the audit trail clearly records which source was used.
 *
 * IMPORTANT: the fallback is intentional and safe for non-networked/dev
 * environments, but for production legal documents the server should have
 * reliable NTP access.  A 'system_clock_fallback' entry in the audit trail
 * signals that NTP was unavailable at signing time.
 */

const ntpClient = require('ntp-client');

const DEFAULT_NTP_SERVER  = process.env.NTP_SERVER  || 'pool.ntp.org';
const DEFAULT_NTP_PORT    = Number(process.env.NTP_PORT) || 123;
const DEFAULT_TIMEOUT_MS  = Number(process.env.NTP_TIMEOUT_MS) || 3000;

function getSystemTime() {
  return { timestamp: new Date(), source: 'system_clock_fallback' };
}

/**
 * Returns { timestamp: Date, source: 'ntp' | 'system_clock_fallback' }.
 *
 * source='ntp'                 — timestamp came from the NTP server; trustworthy.
 * source='system_clock_fallback' — NTP was unreachable; system clock used instead.
 *   Callers should log this so the audit trail reflects that NTP was unavailable.
 *
 * Never throws — always resolves (after at most timeoutMs ms).
 */
async function getSyncedTime(
  ntpServer = DEFAULT_NTP_SERVER,
  ntpPort   = DEFAULT_NTP_PORT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(
        `[ntpTime] NTP query to ${ntpServer}:${ntpPort} timed out after ${timeoutMs}ms — ` +
        'falling back to system clock. Signing timestamp source: system_clock_fallback.'
      );
      resolve(getSystemTime());
    }, timeoutMs);

    try {
      ntpClient.getNetworkTime(ntpServer, ntpPort, (err, date) => {
        clearTimeout(timer);
        if (err || !date) {
          console.warn(
            `[ntpTime] NTP query failed (${err ? err.message : 'no date returned'}) — ` +
            'falling back to system clock. Signing timestamp source: system_clock_fallback.'
          );
          resolve(getSystemTime());
        } else {
          resolve({ timestamp: date, source: 'ntp' });
        }
      });
    } catch (syncErr) {
      clearTimeout(timer);
      console.warn(
        `[ntpTime] NTP client threw synchronously (${syncErr.message}) — ` +
        'falling back to system clock.'
      );
      resolve(getSystemTime());
    }
  });
}

module.exports = { getSyncedTime, getSystemTime };
