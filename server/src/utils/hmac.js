/**
 * FR-024: per-approver HMAC-SHA256 signing.
 *
 * Each approver has their own signing secret stored encrypted in
 * users.signing_secret_enc (AES-256-GCM via encryption.js).
 * The HMAC is computed as HMAC-SHA256(fileHash | timestampIso, approverSecret).
 *
 * Backward-compatibility:
 *   Signatures created before this change used the server-wide HMAC_SECRET.
 *   Those rows are still verifiable: call computeSignatureHmac with the legacy
 *   secret, or use verifySignatureHmac with { legacy: true }.
 *   New signatures always use the per-approver secret.
 *
 * Secret management:
 *   - approverSecret is NEVER returned to the frontend.
 *   - It is generated server-side (crypto.randomBytes(32)), then encrypted before
 *     storage. The raw value exists only in memory during the signing call.
 *   - The server-wide HMAC_SECRET is kept as the fallback for verifying old sigs.
 */

const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('./encryption');
const { pool } = require('../config/db');
require('dotenv').config();

const LEGACY_HMAC_SECRET = process.env.HMAC_SECRET || 'insecure_dev_hmac_secret_change_me';

if (!process.env.HMAC_SECRET) {
  console.warn('[hmac] WARNING: HMAC_SECRET is not set in .env — using an insecure fallback for legacy signature verification.');
}

/**
 * Generates a cryptographically strong per-approver signing secret (256-bit),
 * encrypts it, and persists it to users.signing_secret_enc.
 * Returns the raw (decrypted) secret string for immediate use.
 */
async function provisionApproverSecret(approverId) {
  const rawSecret = crypto.randomBytes(32).toString('hex'); // 256-bit hex
  const encrypted = encryptSecret(rawSecret);
  await pool.query(
    'UPDATE users SET signing_secret_enc = ? WHERE id = ?',
    [encrypted, approverId]
  );
  return rawSecret;
}

/**
 * Retrieves the decrypted per-approver signing secret.
 * If the approver has no secret yet (first time signing), one is generated and stored.
 * Never returns null — always provisions on first call.
 */
async function getApproverSecret(approverId) {
  const [[row]] = await pool.query(
    'SELECT signing_secret_enc FROM users WHERE id = ?',
    [approverId]
  );
  if (!row) throw new Error(`Approver ${approverId} not found.`);

  if (row.signing_secret_enc) {
    const decrypted = decryptSecret(row.signing_secret_enc);
    if (decrypted) return decrypted;
    // Decryption failed (key rotation? corrupted?): regenerate.
    console.warn(`[hmac] Could not decrypt signing_secret_enc for approver ${approverId} — regenerating.`);
  }

  // First signing for this approver, or regeneration needed.
  return provisionApproverSecret(approverId);
}

/**
 * FR-024: compute HMAC-SHA256 using the per-approver secret.
 * message = `${fileHash}|${timestampIso}`
 */
function computeSignatureHmac(fileHash, timestampIso, approverSecret) {
  const secret = approverSecret || LEGACY_HMAC_SECRET;
  return crypto
    .createHmac('sha256', secret)
    .update(`${fileHash}|${timestampIso}`)
    .digest('hex');
}

/**
 * Verifies an HMAC against a known fileHash + timestamp.
 * Tries the per-approver secret first; falls back to the legacy server-wide
 * secret so old signatures remain verifiable without a migration.
 *
 * Returns: { valid: boolean, usedLegacySecret: boolean }
 */
async function verifySignatureHmac(fileHash, timestampIso, storedHmac, approverId) {
  // Try per-approver secret first (new signatures)
  if (approverId) {
    try {
      const approverSecret = await getApproverSecret(approverId);
      const expected = computeSignatureHmac(fileHash, timestampIso, approverSecret);
      if (expected === storedHmac) return { valid: true, usedLegacySecret: false };
    } catch (err) {
      console.warn(`[hmac] Could not retrieve approver secret for verification (approver ${approverId}):`, err.message);
    }
  }

  // Fall back to legacy server-wide secret for old signatures
  const legacyExpected = computeSignatureHmac(fileHash, timestampIso, LEGACY_HMAC_SECRET);
  return { valid: legacyExpected === storedHmac, usedLegacySecret: true };
}

module.exports = {
  computeSignatureHmac,
  verifySignatureHmac,
  getApproverSecret,
  provisionApproverSecret,
};
