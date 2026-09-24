const pageSpec = require('../../../client/src/shared/documentPageSpec.json');
function assembleDocumentHtml({ headerHtml, bodyHtml, footerHtml, tamperProofFooterHtml, deliveryVerificationQrHtml, watermarkText, signatureHtml, companySealHtml }) {
  // color coding: DRAFT stays red (unapproved/in-progress), FINAL is green
  const watermarkClass = watermarkText === 'FINAL'
    ? 'watermark-overlay watermark-final'
    : watermarkText === 'DRAFT'
      ? 'watermark-overlay watermark-draft'
      : 'watermark-overlay';
  const watermarkBlock = watermarkText
    ? `<div class="${watermarkClass}">${escapeHtml(watermarkText)}</div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  /* Uniform on all 4 sides, sourced from pageSpec — kept in sync with the .page rule
     below even though page.pdf() currently passes its own margin:0 and overrides this
     (see pdfGenerator.js), so this stays correct as a fallback for any other renderer
     (e.g. a direct browser "Print" of this HTML) instead of silently going stale. */
  @page { size: A4; margin: ${pageSpec.pagePaddingMm}mm; }
  /*
   * FR-014 Unicode support: the base "Noto Sans" family only covers Latin/Cyrillic/
   * Greek/Vietnamese — it does NOT include Arabic, Ethiopic (Amharic/Ge'ez), or CJK
   * (Chinese/Japanese/Korean) glyphs, despite the name suggesting otherwise. Chromium
   * (which Puppeteer drives) resolves font-family lists per-character: for every glyph
   * it walks the stack left-to-right and uses the first font that actually has that
   * character, falling through to the next entry rather than failing. So listing every
   * script's dedicated Noto family here — instead of relying on one generic name — is
   * what actually makes Arabic/Amharic/Chinese (and Hebrew/Devanagari/Korean/Japanese)
   * text render instead of showing as tofu boxes (□□□) or blank space.
   * This still depends on the fonts being installed on the machine/container running
   * Puppeteer's Chromium — see backend/FONTS.md for the required OS packages; there is
   * no bundled/embedded font file here to fall back on.
   */
  body {
    font-family: 'Noto Sans', 'Noto Sans Arabic', 'Noto Naskh Arabic', 'Noto Sans Ethiopic',
      'Noto Sans Hebrew', 'Noto Sans Devanagari', 'Noto Sans SC', 'Noto Sans TC',
      'Noto Sans JP', 'Noto Sans KR', Arial, sans-serif;
    /* No forced text color here on purpose: the PDF must render placeholders and
       authored content in exactly the color they were given in the template editor
       (RichTextEditor) / preview (TemplateViewer) — same #1a1a2e inherited default,
       and any inline color a field/placeholder itself carries. Never overwrite it
       with a separate "PDF-only" color. */
    color: #1a1a2e;
    position: relative;
    margin: 0;
    /* Lets the browser's bidi algorithm pick text direction per paragraph instead of
       forcing LTR everywhere — needed for Arabic (RTL) content mixed into an otherwise
       LTR (English/Amharic) document to flow and punctuate correctly. */
    unicode-bidi: plaintext;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    /* Uniform on all 4 sides — matches TemplateViewer.jsx's .a4-page padding exactly
       (same pageSpec.json), so the PDF's margins are identical, corner for corner, to
       what was reviewed on the View page. */
    padding: ${pageSpec.pagePaddingMm}mm;
    box-sizing: border-box;
    position: relative;
    background: #fff;
  }
  /* No margin/min-height/font overrides here — the preview concatenates header + body
     + footer flush against each other with no extra spacing or restyling (see
     combinedHtml in documentController.js), so this must not add any either. */
  .doc-header { margin-bottom: 0; }
  .doc-body { min-height: 0; }
  .doc-footer { margin-top: 0; }
  /* Verification stamp only (signature + tamper-proof footer) — this never appears in
     the preview at all, so unlike .doc-footer it's free to have its own distinct,
     deliberately small/gray "stamp" styling without affecting the author's own footer
     content above it. */
  .doc-footer-meta { margin-top: 24px; font-size: 11px; color: #444; }
  /* Two-QR footer row: left QR = verify by Doc ID, right QR = scan for VALID/REVOKED.
     Both sit inside .doc-footer-meta so they share the same border-top stamp styling. */
  .qr-footer-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    font-size: 9px;
    color: #555;
    /* The company seal floats left/right beside the signature text above; never let
       it collide with the verification QR footer. */
    clear: both;
  }
  .qr-footer-left  { display:flex; align-items:center; gap:6px; }
  .qr-footer-right { display:flex; align-items:center; gap:6px; }
  .watermark-overlay {
    position: fixed;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72px;
    font-weight: 700;
    color: rgba(220, 38, 38, 0.18);
    letter-spacing: 4px;
    z-index: 0;
    pointer-events: none;
    white-space: nowrap;
  }
  /* FR-017: DRAFT (unapproved) is always red; FINAL (approved) is always green — kept
     visually distinct on purpose so the two are never mistaken for each other. */
  .watermark-overlay.watermark-draft { color: rgba(220, 38, 38, 0.18); }
  .watermark-overlay.watermark-final { color: rgba(22, 163, 74, 0.20); }
  .doc-header, .doc-body, .doc-footer, .doc-footer-meta { position: relative; z-index: 1; }
  /* Font size mapping — matches the editor's FONT_SIZE_OPTIONS exactly, so what admins see while
     authoring in RichTextEditor.jsx is what actually renders in the generated PDF. */
  font[size="1"] { font-size: 10px; }
  font[size="2"] { font-size: 13px; }
  font[size="3"] { font-size: 16px; }
  font[size="4"] { font-size: 18px; }
  font[size="5"] { font-size: 24px; }
  font[size="6"] { font-size: 32px; }
  font[size="7"] { font-size: 48px; }
  /* Conditional/loop block markers are authoring-time visual aids only — never shown in the final PDF. */
  .rte-block-marker { display: none; }
</style>
</head>
<body>
  <div class="page">
    ${watermarkBlock}
    <div class="doc-header">${headerHtml || ''}</div>
    <div class="doc-body">${bodyHtml || ''}</div>
    <div class="doc-footer">${footerHtml || ''}</div>
    <div class="doc-footer-meta">
      ${signatureHtml || ''}
      ${companySealHtml || ''}
      <div class="qr-footer-row">
        <div class="qr-footer-left">${tamperProofFooterHtml || ''}</div>
        <div class="qr-footer-right">${deliveryVerificationQrHtml || ''}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
//watermark is status-driven, not just a static template field.
 
function resolveWatermarkForStatus(docStatus, templateWatermarkText) {
  const cleanTemplateWatermark =
    templateWatermarkText && String(templateWatermarkText).trim().toUpperCase() !== 'DRAFT'
      ? templateWatermarkText
      : null;

  if (docStatus === 'draft' || docStatus === 'pending' || docStatus === 'rejected') {
    return 'DRAFT';
  }
  if (docStatus === 'signed' || docStatus === 'delivered') {
    return cleanTemplateWatermark || 'FINAL';
  }
  return cleanTemplateWatermark || null;
}

function buildCompanySealHtml({ companySeal, companyName, docId, dateString }) {
  if (!companySeal || !companySeal.enabled) return '';
  const size = Number(companySeal.size) || 110;
  const position = ['left', 'center', 'right'].includes(companySeal.position)
    ? companySeal.position
    : 'right';

  let sealElement;
  if (companySeal.imageUrl) {
    // A real uploaded seal — shown as a circular stamp with a subtle double ring.
    sealElement = `<img src="${companySeal.imageUrl}" alt="Company Seal"
      style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;
             box-shadow:0 0 0 1.5px rgba(15,39,71,0.55), 0 0 0 3px #fff, 0 0 0 4px rgba(15,39,71,0.35);" />`;
  } else {
    sealElement = buildGeneratedSealSvg({
      org: companyName,
      stampId: docId,
      stampDate: dateString,
      size,
    });
  }

  // Position the seal against the signature text: float left/right or center above it.
  const wrapStyle = position === 'left'
    ? 'float:left;margin:8px 18px 8px 0;'
    : position === 'center'
      ? 'display:block;width:100%;text-align:center;margin:8px 0 2px;'
      : 'float:right;margin:8px 0 8px 18px;';

  return `<div style="${wrapStyle}">${sealElement}</div>`;
}

/** Builds the auto-generated circular stamp as inline SVG (the "no artwork uploaded" fallback). */
function buildGeneratedSealSvg({ org, stampId, stampDate, size }) {
  const name = String(org || '').trim().toUpperCase() || 'OFFICIAL DOCUMENT';
  const displayName = name.length > 34 ? `${name.slice(0, 33)}…` : name;
  const id = String(stampId || 'DOC');
  const date = String(stampDate || '');

  // Two arcs let the rim text read upright on both halves: the top arc sweeps
  const topArc    = '<path id="sealTop" d="M 22,60 A 38,38 0 1 1 98,60" fill="none" />';
  const bottomArc = '<path id="sealBottom" d="M 22,60 A 38,38 0 0 0 98,60" fill="none" />';

  return `
  <svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"
       role="img" aria-label="Official company seal">
    <circle cx="60" cy="60" r="58.5" fill="#f8fafc" stroke="#0F2747" stroke-width="2.5"/>
    <circle cx="60" cy="60" r="49.5" fill="none" stroke="#0F2747" stroke-width="1"/>
    <circle cx="60" cy="60" r="26" fill="none" stroke="#0F2747" stroke-width="0.8"/>
    <defs>${topArc}${bottomArc}</defs>
    <text font-family="Arial, 'Noto Sans', sans-serif" font-size="9" font-weight="bold" fill="#0F2747" letter-spacing="1.5">
      <textPath href="#sealTop">${escapeHtml(displayName)}</textPath>
    </text>
    <text font-family="Arial, 'Noto Sans', sans-serif" font-size="7.5" fill="#0F2747" letter-spacing="1">
      <textPath href="#sealBottom">OFFICIAL DOCUMENT</textPath>
    </text>
    <text x="60" y="61" text-anchor="middle" font-family="Arial, 'Noto Sans', sans-serif"
          font-size="8.5" font-weight="bold" fill="#0F2747">${escapeHtml(id)}</text>
    <text x="60" y="73" text-anchor="middle" font-family="Arial, 'Noto Sans', sans-serif"
          font-size="5.5" fill="#475569">${escapeHtml(date)}</text>
    <text x="60" y="85" text-anchor="middle" font-family="Arial, 'Noto Sans', sans-serif"
          font-size="5.5" letter-spacing="2" fill="#0F2747">• VERIFIED •</text>
  </svg>`;
}
function injectSignatureIntoFooter(footerHtml, name, photoDataUrl, signedAt) {
  if (!footerHtml) return footerHtml || '';

  // The placeholder block is delimited by these exact HTML comments, which are
  const START_MARKER = '<!-- [[SIGNATURE_FIELD]] -->';
  const END_MARKER   = '<!-- [[/SIGNATURE_FIELD]] -->';

  const startIdx = footerHtml.indexOf(START_MARKER);
  const endIdx   = footerHtml.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    // No placeholder found — footer is already signed or template did not use
    return footerHtml;
  }
  // Format the date in a human-readable way for the PDF
  const dateStr = signedAt
    ? new Date(signedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Build the signature image cell — only included when a photo/drawing was provided
  const sigImgHtml = photoDataUrl
    ? `<img src="${photoDataUrl}" alt="Signature"
            style="display:block;max-height:48px;max-width:180px;object-fit:contain;" />`
    : `<span style="font-size:0.72rem;color:#94A3B8;font-style:italic;">No image provided</span>`;

  // The filled-in block that replaces everything from START_MARKER to END_MARKER
  const signedBlock = `<!-- [[SIGNATURE_FIELD]] -->
<table style="width:100%;border-collapse:collapse;font-family:inherit;font-size:12px;color:#1a1a2e;margin-top:4px;">
  <tbody>
    <tr>
      <td style="width:38%;padding:4px 8px 4px 0;vertical-align:bottom;">
        <div style="padding-bottom:3px;min-width:80px;font-family:Georgia,serif;font-size:13px;color:#0F2747;border-bottom:1.5px solid #0F2747;">
          ${name ? escapeHtml(name) : ''}
        </div>
        <div style="margin-top:4px;font-size:9px;color:#94A3B8;letter-spacing:0.04em;text-transform:uppercase;">Name</div>
      </td>
      <td style="width:62%;padding:4px 0 4px 8px;vertical-align:bottom;">
        <div style="border:1.5px solid #0F2747;border-radius:4px;min-height:48px;padding:4px 6px;background:#fff;display:flex;align-items:center;justify-content:center;">
          ${sigImgHtml}
        </div>
        <div style="margin-top:4px;font-size:9px;color:#94A3B8;letter-spacing:0.04em;text-transform:uppercase;">Signature</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:8px 0 0;vertical-align:bottom;">
        <div style="padding-bottom:3px;border-bottom:1.5px solid #94A3B8;font-size:12px;color:#0F2747;">
          ${dateStr}
        </div>
        <div style="margin-top:4px;font-size:9px;color:#94A3B8;letter-spacing:0.04em;text-transform:uppercase;">Date</div>
      </td>
    </tr>
  </tbody>
</table>
<!-- [[/SIGNATURE_FIELD]] -->`;
  // Find the outer wrapper `<div ... data-sig-field="1">` that encloses both markers.
  let outerStart = footerHtml.lastIndexOf('<div', startIdx);
  let outerEnd   = footerHtml.indexOf('</div>', endIdx + END_MARKER.length);

  if (outerStart === -1 || outerEnd === -1) {
    // Fallback: just replace between the markers without touching the wrapper
    const before = footerHtml.slice(0, startIdx);
    const after  = footerHtml.slice(endIdx + END_MARKER.length);
    return before + signedBlock + after;
  }

  const before = footerHtml.slice(0, outerStart);
  const after  = footerHtml.slice(outerEnd + '</div>'.length);
  return before + signedBlock + after;
}

module.exports = { assembleDocumentHtml, resolveWatermarkForStatus, injectSignatureIntoFooter, buildCompanySealHtml };
