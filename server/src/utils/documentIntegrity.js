const crypto = require('crypto');
const QRCode = require('qrcode');

/** SHA-256 hex digest of a file buffer — used for tamper-proofing (FR-016, NFR-003). */
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** FR-015: DOC-YYYYMMDD-XXXXX */
function generateDocId() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `DOC-${datePart}-${randomPart}`;
}

/**
 * FR-016 / C-2: builds the tamper-proof footer HTML.
 *
 * CIRCULAR HASH AVOIDANCE
 * ──────────────────────────────────────────────────────────────────────
 * Embedding the final PDF's SHA-256 inside the QR that is part of the
 * PDF itself is impossible without an infinite regress: any change to the
 * QR changes the PDF, which changes the hash, which changes the QR, …
 *
 * Resolution: the QR encodes a *content hash* — the SHA-256 of the
 * rendered document HTML (header + body + footer, BEFORE Puppeteer
 * converts it to a PDF and BEFORE the QR footer is appended). This hash:
 *   • is fully determined before the QR image is generated, so there is
 *     no circularity;
 *   • covers the entire document content (text, layout, data) that a
 *     recipient actually reads, which is what tamper-proofing protects;
 *   • does NOT cover the QR footer itself or the PDF rendering artefacts,
 *     which are deterministic renderings of the same content and do not
 *     change the semantic meaning of the document.
 *
 * The final PDF's SHA-256 is still stored in generated_docs.file_hash and
 * used by the /verify endpoint for file-level integrity checking.  The
 * two hashes serve different purposes and are both stored in the DB.
 *
 * QR payload (JSON, UTF-8 encoded in the QR):
 *   {
 *     "docId":       "DOC-20260914-A1B2C",   // FR-015 unique ID
 *     "issuedAt":    "2026-09-14T10:30:00Z",  // ISO-8601 UTC timestamp
 *     "contentHash": "<sha256 hex>",           // SHA-256 of rendered content HTML
 *     "verifyUrl":   "https://…/verify?id=…"  // clickable verify link
 *   }
 *
 * Verification flow:
 *   1. Scan the QR → parse JSON → extract verifyUrl → open in browser.
 *   2. The /verify page shows stored metadata (status, hash, issued date).
 *   3. Optionally upload the PDF — the backend recomputes file_hash and
 *      compares to generated_docs.file_hash to confirm file integrity.
 *
 * @param {string} docId          FR-015 document identifier
 * @param {string} verifyBaseUrl  frontend base URL (e.g. https://app.example.com)
 * @param {string} contentHash    SHA-256 of the rendered document content HTML
 * @param {Date}   issuedAt       generation timestamp (from NTP or system clock)
 */
async function buildTamperProofFooterHtml(docId, verifyBaseUrl, contentHash, issuedAt) {
  const issuedAtIso = (issuedAt instanceof Date ? issuedAt : new Date()).toISOString();
  const docVerifyUrl = `${verifyBaseUrl}/verify?id=${encodeURIComponent(docId)}`;

  // Structured QR payload satisfying FR-016: Doc ID + timestamp + SHA-256 hash + URL.
  const qrPayload = JSON.stringify({
    docId,
    issuedAt: issuedAtIso,
    contentHash: contentHash || '',
    verifyUrl: docVerifyUrl,
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 140 });

  return `
    <div class="tamper-proof-footer" style="
      display:flex; align-items:flex-start; justify-content:space-between;
      gap:8px; font-size:9px; color:#555;
      margin-top:12px; border-top:1px solid #ccc; padding-top:8px;">
      <!-- Tamper-proof QR: encodes Doc ID + issuedAt timestamp + content hash + verify URL -->
      <div style="display:flex;align-items:center;gap:6px;flex:1;">
        <img src="${qrDataUrl}" alt="Verify Authenticity QR" style="width:56px;height:56px;flex-shrink:0;" />
        <div>
          <div style="font-weight:600;margin-bottom:2px;">Verify Authenticity</div>
          <!-- FR-034: required statement with exact URL and Doc ID -->
          <div>Verify this document at <b>${verifyBaseUrl}/verify</b> with ID: <b>${docId}</b></div>
          <div style="margin-top:2px;font-size:8px;color:#888;">Issued: ${issuedAtIso}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Secure Document Delivery module: the RIGHT-side QR code embedded in every generated
 * PDF. Encodes ONLY the opaque `verification_id` — never the doc_uuid, never the file
 * hash. Scanning it opens the public /verify-qr/:id page which reports exactly one of
 * VALID / REVOKED / INVALID.
 */
async function buildDeliveryVerificationQrHtml(verificationId, verifyBaseUrl) {
  const verifyUrl = `${verifyBaseUrl}/verify-qr/${encodeURIComponent(verificationId)}`;
  const qrScan = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 });

  return `
    <div class="delivery-verification-footer" style="
      display:flex; align-items:flex-start; justify-content:flex-end;
      font-size:9px; color:#555; margin-top:4px;">
      <!-- RIGHT: scan to get VALID / REVOKED / INVALID instantly -->
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="text-align:right;">
          <div style="font-weight:600;margin-bottom:2px;">Delivery Status</div>
          <div>Scan to verify: <b>VALID / REVOKED / INVALID</b></div>
        </div>
        <img src="${qrScan}" alt="Delivery Status QR" style="width:52px;height:52px;flex-shrink:0;" />
      </div>
    </div>
  `;
}

module.exports = { sha256, generateDocId, buildTamperProofFooterHtml, buildDeliveryVerificationQrHtml };
