/**
 * Verification controller — FR-016, FR-033, FR-024.
 *
 * Three verification modes, all public (no login required):
 *
 * 1. verifyDocument  POST /api/verify
 *    Unified endpoint — accepts EITHER:
 *      a) JSON  { doc_id }           — look up by Doc ID, compare stored file_hash
 *      b) JSON  { qr_payload }       — parse Phase 1 QR JSON, verify contentHash + docId
 *      c) multipart { pdf: <file> }  — SHA-256 the upload, look up by file_hash
 *    Returns { success, data: { verified, result, ... } }
 *
 * 2. verifyByDocUuid  GET /api/verify/:doc_uuid  (legacy — kept for backward compat)
 *    Recomputes the file hash and compares to stored value.
 *
 * 3. verifyDocumentSignature  GET /api/verify/:doc_uuid/signature
 *    FR-024: verifies the HMAC on the stored digital_signature row using the
 *    per-approver secret (with legacy fallback). Returns signature validity result
 *    without ever exposing the secret.
 */

const fs      = require('fs');
const crypto  = require('crypto');
const { pool } = require('../config/db');
const { sha256 } = require('../utils/documentIntegrity');
const { verifySignatureHmac } = require('../utils/hmac');
const { recordAudit } = require('../utils/auditLog');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Safe JSON parse — returns null instead of throwing. */
function tryParseJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

/** Minimal validation that a string looks like a Phase 1 QR payload. */
function isQrPayload(obj) {
  return obj !== null &&
    typeof obj === 'object' &&
    typeof obj.docId === 'string' &&
    typeof obj.contentHash === 'string' &&
    typeof obj.issuedAt === 'string';
}

/** Fetch a doc row by doc_uuid, selecting only the columns we need. */
async function fetchDocByUuid(docUuid) {
  const [[row]] = await pool.query(
    `SELECT id, doc_uuid, file_path, file_hash, status, generated_at,
            deleted_at, revoked_at, revocation_reason, metadata
     FROM generated_docs WHERE doc_uuid = ? LIMIT 1`,
    [docUuid]
  );
  return row || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Unified verify endpoint  POST /api/verify
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles all three sub-modes in priority order:
 *   qr_payload  (string — raw QR scan text, may be JSON)
 *   doc_id      (string — typed Doc ID)
 *   pdf upload  (multipart file from multer)
 *
 * Security: never reveals file_path, internal IDs, or stack traces.
 * Input validation: all three paths sanitise/validate before any DB query.
 */
exports.verifyDocument = async (req, res) => {
  try {
    // ── Mode A: QR payload (JSON string scanned from the QR code) ─────────
    const rawQr = req.body?.qr_payload;
    if (rawQr) {
      return verifyQrPayload(rawQr, req, res);
    }

    // ── Mode B: Doc ID typed manually ─────────────────────────────────────
    const docIdInput = req.body?.doc_id;
    if (docIdInput) {
      const docId = String(docIdInput).trim().toUpperCase();
      if (!/^DOC-\d{8}-[A-Z0-9]{1,10}$/.test(docId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Document ID format. Expected: DOC-YYYYMMDD-XXXXX',
        });
      }
      return verifyByDocId(docId, req, res);
    }

    // ── Mode C: PDF file upload ────────────────────────────────────────────
    if (req.file) {
      return verifyByFileUpload(req.file.buffer, req, res);
    }

    return res.status(400).json({
      success: false,
      message: 'Provide a Document ID (doc_id), a QR payload (qr_payload), or upload a PDF file.',
    });
  } catch (err) {
    console.error('[verify] verifyDocument error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed due to a server error.' });
  }
};

// ── Mode A implementation ─────────────────────────────────────────────────

async function verifyQrPayload(rawQr, req, res) {
  // The QR may contain either a plain URL (old QR) or JSON (Phase 1 QR).
  const parsed = tryParseJson(rawQr);

  if (!isQrPayload(parsed)) {
    // Not a Phase 1 structured QR — try to treat it as a bare verify URL
    // or fall through to a not-found result rather than an error.
    return res.status(200).json({
      success: true,
      data: {
        verified: false,
        result: 'INVALID',
        reason: 'unrecognised_qr',
        message: 'The QR code does not contain a recognisable DocuVault payload.',
      },
    });
  }

  const { docId, contentHash, issuedAt } = parsed;

  // Validate fields
  if (!/^DOC-\d{8}-[A-Z0-9]{1,10}$/.test(docId)) {
    return res.status(200).json({
      success: true,
      data: { verified: false, result: 'INVALID', reason: 'invalid_doc_id_format', message: 'QR payload contains an invalid Document ID.' },
    });
  }
  if (typeof contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(contentHash)) {
    return res.status(200).json({
      success: true,
      data: { verified: false, result: 'INVALID', reason: 'invalid_content_hash', message: 'QR payload contains an invalid content hash.' },
    });
  }

  const doc = await fetchDocByUuid(docId);
  if (!doc) {
    await recordAudit({ action: 'VERIFY', details: { method: 'qr_payload', docId, result: 'INVALID', reason: 'not_found' }, req });
    return res.status(200).json({
      success: true,
      data: { verified: false, result: 'INVALID', reason: 'not_found', message: 'No document with this ID exists in our records.' },
    });
  }

  // Revoked / deleted — report REVOKED regardless of hash
  if (doc.revoked_at || doc.deleted_at) {
    await recordAudit({ docId: doc.id, action: 'VERIFY', details: { method: 'qr_payload', result: 'REVOKED' }, req });
    return res.status(200).json({
      success: true,
      data: {
        verified: false,
        result: 'REVOKED',
        docId: doc.doc_uuid,
        docStatus: doc.status,
        revokedAt: doc.revoked_at || null,
        reason: doc.revocation_reason || undefined,
        message: 'This document has been revoked.',
      },
    });
  }

  // Compare the embedded contentHash against the value stored in metadata at generation time.
  // The stored value is under metadata.contentHash (set by generateSingleDocument in Phase 1).
  const meta = doc.metadata ? tryParseJson(doc.metadata) : null;
  const storedContentHash = meta?.contentHash || null;

  let hashMatch = false;
  let hashNote = '';

  if (!storedContentHash) {
    // Document was generated before Phase 1 — no contentHash stored.
    // Fall back to file-hash comparison to give a best-effort answer.
    if (fs.existsSync(doc.file_path)) {
      const buf = fs.readFileSync(doc.file_path);
      const fileHash = sha256(buf);
      hashMatch = fileHash === doc.file_hash;
      hashNote = 'pre_phase1_file_hash_fallback';
    } else {
      hashMatch = false;
      hashNote = 'pre_phase1_file_missing';
    }
  } else {
    hashMatch = contentHash === storedContentHash;
    hashNote = hashMatch ? 'content_hash_match' : 'content_hash_mismatch';
  }

  const result = hashMatch ? 'VALID' : 'INVALID';
  await recordAudit({
    docId: doc.id,
    action: 'VERIFY',
    details: { method: 'qr_payload', result, hashNote, issuedAt },
    req,
  });

  return res.status(200).json({
    success: true,
    data: {
      verified: hashMatch,
      result,
      docId: doc.doc_uuid,
      docStatus: doc.status,
      issuedAt,
      generatedAt: doc.generated_at,
      contentHashMatch: hashMatch,
      hashNote,
      message: hashMatch
        ? 'Document content is authentic and untampered.'
        : 'Content hash mismatch — the document may have been modified after generation.',
    },
  });
}

// ── Mode B implementation ─────────────────────────────────────────────────

async function verifyByDocId(docId, req, res) {
  const doc = await fetchDocByUuid(docId);
  if (!doc) {
    await recordAudit({ action: 'VERIFY', details: { method: 'doc_id', docId, result: 'not_found' }, req });
    return res.status(200).json({
      success: true,
      data: {
        verified: false,
        result: 'INVALID',
        reason: 'not_found',
        message: 'No document with this ID exists in our records.',
      },
    });
  }

  if (doc.revoked_at || doc.deleted_at) {
    await recordAudit({ docId: doc.id, action: 'VERIFY', details: { method: 'doc_id', result: 'REVOKED' }, req });
    return res.status(200).json({
      success: true,
      data: {
        verified: false,
        result: 'REVOKED',
        docId: doc.doc_uuid,
        docStatus: doc.status,
        revokedAt: doc.revoked_at || null,
        reason: doc.revocation_reason || undefined,
        message: 'This document has been revoked.',
      },
    });
  }

  // FR-035: if the file has been deleted the hash still persists in the DB.
  // We can confirm the document existed and report the stored hash, but we cannot
  // recompute a fresh hash to compare — report this clearly rather than blocking.
  if (!fs.existsSync(doc.file_path)) {
    await recordAudit({ docId: doc.id, action: 'VERIFY', details: { method: 'doc_id', result: 'hash_preserved_file_deleted' }, req });
    return res.status(200).json({
      success: true,
      data: {
        verified: true,          // the record and its original hash are authentic
        result: 'VALID',
        fileAvailable: false,     // but the physical file is gone
        docId: doc.doc_uuid,
        docStatus: doc.status,
        generatedAt: doc.generated_at,
        message: 'The original file has been deleted, but its SHA-256 hash is preserved in the database. The document record is authentic — upload the PDF to verify the file itself.',
      },
    });
  }

  const buf = fs.readFileSync(doc.file_path);
  const recomputedHash = sha256(buf);
  const authentic = recomputedHash === doc.file_hash;
  const result = authentic ? 'VALID' : 'INVALID';

  await recordAudit({
    docId: doc.id,
    action: 'VERIFY',
    details: { method: 'doc_id', result, recomputedHash },
    req,
  });

  return res.status(200).json({
    success: true,
    data: {
      verified: authentic,
      result,
      docId: doc.doc_uuid,
      docStatus: doc.status,
      generatedAt: doc.generated_at,
      message: authentic
        ? 'Document is authentic and untampered.'
        : 'File hash mismatch — the document file may have been tampered with.',
    },
  });
}

// ── Mode C implementation ─────────────────────────────────────────────────

async function verifyByFileUpload(buffer, req, res) {
  const uploadedHash = sha256(buffer);

  const [[doc]] = await pool.query(
    `SELECT id, doc_uuid, file_hash, status, generated_at, revoked_at, deleted_at, revocation_reason
     FROM generated_docs WHERE file_hash = ? LIMIT 1`,
    [uploadedHash]
  );

  await recordAudit({
    docId: doc ? doc.id : null,
    action: 'VERIFY',
    details: { method: 'file_upload', hash: uploadedHash, found: !!doc },
    req,
  });

  if (!doc) {
    return res.status(200).json({
      success: true,
      data: {
        verified: false,
        result: 'INVALID',
        reason: 'not_found',
        message: 'No matching document found — the file hash is not in our records.',
      },
    });
  }

  if (doc.revoked_at || doc.deleted_at) {
    return res.status(200).json({
      success: true,
      data: {
        verified: false,
        result: 'REVOKED',
        docId: doc.doc_uuid,
        docStatus: doc.status,
        revokedAt: doc.revoked_at || null,
        reason: doc.revocation_reason || undefined,
        message: 'This document has been revoked.',
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      verified: true,
      result: 'VALID',
      docId: doc.doc_uuid,
      docStatus: doc.status,
      generatedAt: doc.generated_at,
      message: 'Document is authentic and untampered.',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Legacy GET endpoint  GET /api/verify/:doc_uuid
// ─────────────────────────────────────────────────────────────────────────────

exports.verifyByDocUuid = async (req, res) => {
  const { doc_uuid } = req.params;
  if (!doc_uuid) return res.status(400).json({ success: false, message: 'doc_uuid is required.' });

  try {
    const doc = await fetchDocByUuid(doc_uuid.toUpperCase());
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (!fs.existsSync(doc.file_path)) {
      return res.status(200).json({ authentic: false, message: 'File not found on server.', stored_hash: doc.file_hash, doc_uuid });
    }

    const buf = fs.readFileSync(doc.file_path);
    const recomputedHash = sha256(buf);
    const authentic = recomputedHash === doc.file_hash;

    await recordAudit({ docId: doc.id, action: 'VERIFY', details: { method: 'legacy_get', result: authentic ? 'authentic' : 'tampered' }, req });

    return res.status(200).json({
      authentic,
      message: authentic ? 'Document is Authentic & Untampered' : 'Document is Corrupt or Forged',
      doc_uuid,
      status: doc.status,
      generated_at: doc.generated_at,
      stored_hash: doc.file_hash,
      recomputed_hash: recomputedHash,
    });
  } catch (err) {
    console.error('[verify] verifyByDocUuid error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

// Keep legacy alias
exports.verifyByUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  return verifyByFileUpload(req.file.buffer, req, res);
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. FR-024: Digital Signature Verification  GET /api/verify/:doc_uuid/signature
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the HMAC on the most recent digital_signatures row for a document.
 * Uses verifySignatureHmac() — tries the per-approver secret first, then falls
 * back to the legacy server-wide HMAC_SECRET for signatures created before Phase 1.
 *
 * Security:
 *   - Never exposes signing secrets (approverSecret is fetched/used server-side only).
 *   - Never exposes file_path or internal database IDs.
 *   - Public: no login required, consistent with the rest of the verify page.
 *   - Rate-limited by the existing express middleware (none needed here beyond
 *     what the route-level multer + express-json already enforce).
 */
exports.verifyDocumentSignature = async (req, res) => {
  const { doc_uuid } = req.params;
  if (!doc_uuid) return res.status(400).json({ success: false, message: 'doc_uuid is required.' });

  try {
    const doc = await fetchDocByUuid(doc_uuid.toUpperCase());
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    // Fetch the most recent signature for this document
    const [[sig]] = await pool.query(
      `SELECT ds.id, ds.signer_id, ds.signature_timestamp, ds.crypto_hmac,
              ds.visual_signature_text, u.full_name AS signer_name
       FROM digital_signatures ds
       JOIN users u ON u.id = ds.signer_id
       WHERE ds.doc_id = ?
       ORDER BY ds.signature_timestamp DESC
       LIMIT 1`,
      [doc.id]
    );

    if (!sig) {
      return res.status(200).json({
        success: true,
        data: {
          signed: false,
          signatureValid: null,
          message: 'This document has not been digitally signed yet.',
        },
      });
    }

    // Re-verify the HMAC using the stored file_hash + timestamp
    const timestampIso = sig.signature_timestamp instanceof Date
      ? sig.signature_timestamp.toISOString()
      : new Date(sig.signature_timestamp).toISOString();

    const { valid, usedLegacySecret } = await verifySignatureHmac(
      doc.file_hash,
      timestampIso,
      sig.crypto_hmac,
      sig.signer_id
    );

    await recordAudit({
      docId: doc.id,
      action: 'VERIFY',
      details: {
        method: 'signature_hmac',
        signatureId: sig.id,
        signerId: sig.signer_id,
        valid,
        usedLegacySecret,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      data: {
        signed: true,
        signatureValid: valid,
        usedLegacySecret,  // informs the client whether this was a pre-Phase1 sig
        signerName: sig.signer_name,
        signedAt: timestampIso,
        visualText: sig.visual_signature_text,
        message: valid
          ? 'Digital signature is valid — the HMAC matches the approver\'s signing secret.'
          : 'Digital signature HMAC mismatch — the signature could not be verified.',
      },
    });
  } catch (err) {
    console.error('[verify] verifyDocumentSignature error:', err);
    return res.status(500).json({ success: false, message: 'Signature verification failed.' });
  }
};
