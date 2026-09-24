/**
 * bulkZipService.js
 *
 * Packages the successfully-generated PDFs from a bulk job into a single ZIP
 * archive so the user can download the whole batch in one click.
 *
 * Scope: SRS "Bulk generation (ZIP)" scope item.
 *
 * Design decisions
 * ────────────────
 * • Uses `archiver` (zip format) — mature, stream-based, handles large batches
 *   without buffering every file in memory.
 * • ZIPs are written to server/storage/bulk-zips/ — outside the public webroot,
 *   consistent with generated-docs storage (NFR-002 / security requirement §9).
 * • The friendly per-PDF filename from metadata.fileName is used inside the ZIP
 *   (FR-018: [TemplateName]_[RecordID]_[Date].pdf). If two records produce the
 *   same name (same template, same date, same ID — essentially impossible in
 *   normal use but guarded anyway), a numeric suffix is appended so no entry
 *   silently overwrites another.
 * • ZIP filename format: Bulk_Documents_YYYYMMDD_HHmmss.zip
 * • Only files that actually exist on disk are included. A missing file is logged
 *   as a warning and excluded — it does NOT abort the whole ZIP.
 * • The ZIP storage directory is created automatically on first use.
 *
 * Public API
 * ──────────
 *   createBulkZip(pdfFiles)   → Promise<{ zipPath, zipFileName, includedCount, skippedCount }>
 *   ZIP_STORAGE_ROOT          directory where ZIPs are stored
 *   ensureZipStorageDir()     idempotent directory creation
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const archiver = require('archiver');

// NFR-002: keep ZIPs outside the public webroot, same convention as generated-docs.
const ZIP_STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage', 'bulk-zips');

/**
 * Creates the bulk-zips storage directory if it does not already exist.
 * Called once inside createBulkZip; safe to call multiple times (idempotent).
 */
function ensureZipStorageDir() {
  if (!fs.existsSync(ZIP_STORAGE_ROOT)) {
    fs.mkdirSync(ZIP_STORAGE_ROOT, { recursive: true });
  }
}

/**
 * Builds the ZIP archive filename using the format:
 *   Bulk_Documents_YYYYMMDD_HHmmss.zip
 *
 * @param {Date} [now]  — defaults to current time
 * @returns {string}
 */
function buildZipFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const date =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `Bulk_Documents_${date}.zip`;
}

/**
 * Resolves the in-ZIP entry name for a PDF.
 *
 * Priority:
 *   1. friendlyName from the job result (metadata.fileName — FR-018 convention)
 *   2. Basename of the on-disk path as a fallback
 *
 * Collision handling: if two entries would share the same name, a counter suffix
 * is appended before the extension — e.g. "Payslip_EMP001_20260916(2).pdf".
 *
 * @param {string}     friendlyName  human-readable name (may be undefined)
 * @param {string}     filePath      absolute on-disk path
 * @param {Set<string>} usedNames    mutable set of names already added to the archive
 * @returns {string}
 */
function resolveEntryName(friendlyName, filePath, usedNames) {
  let base = (friendlyName && friendlyName.trim()) || path.basename(filePath);
  // Strip any path separators a caller might accidentally include in a friendlyName.
  base = path.basename(base);

  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }

  // Collision: append "(2)", "(3)", … until unique.
  const ext  = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  let counter = 2;
  let candidate;
  do {
    candidate = `${stem}(${counter})${ext}`;
    counter  += 1;
  } while (usedNames.has(candidate));

  usedNames.add(candidate);
  return candidate;
}

/**
 * Creates a ZIP archive from the supplied list of PDF file descriptors.
 *
 * @param {Array<{ filePath: string, friendlyName?: string }>} pdfFiles
 *   Each entry must have `filePath` (absolute on-disk path).
 *   `friendlyName` is the FR-018 display name stored in metadata.fileName.
 *
 * @returns {Promise<{
 *   zipPath:       string,   absolute path to the created ZIP
 *   zipFileName:   string,   filename of the ZIP (for Content-Disposition)
 *   includedCount: number,   PDFs successfully added
 *   skippedCount:  number,   PDFs skipped because the file was missing on disk
 * }>}
 *
 * @throws {Error} if no PDFs could be added (all files were missing), or on
 *                 a filesystem/archiver error.
 */
function createBulkZip(pdfFiles) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(pdfFiles) || pdfFiles.length === 0) {
      return reject(new Error('createBulkZip: pdfFiles must be a non-empty array.'));
    }

    ensureZipStorageDir();

    const zipFileName = buildZipFileName();
    const zipPath     = path.join(ZIP_STORAGE_ROOT, zipFileName);

    const output  = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 6 }, // balanced compression — not max (slow) nor none (large)
    });

    // ── Wire up event handlers before piping ──────────────────────────────

    output.on('close', () => {
      resolve({ zipPath, zipFileName, includedCount, skippedCount });
    });

    // 'finish' fires on some archiver versions instead of (or in addition to)
    // the output stream's 'close' — guard here so we don't resolve twice.
    let settled = false;
    const safeResolve = (value) => {
      if (!settled) { settled = true; resolve(value); }
    };
    const safeReject  = (err)   => {
      if (!settled) { settled = true; reject(err); }
    };

    output.on('close', () => safeResolve({ zipPath, zipFileName, includedCount, skippedCount }));
    archive.on('error', (err) => {
      console.error('[bulkZip] archiver error:', err.message);
      safeReject(err);
    });
    output.on('error', (err) => {
      console.error('[bulkZip] output stream error:', err.message);
      safeReject(err);
    });

    archive.pipe(output);

    // ── Add files ─────────────────────────────────────────────────────────

    let includedCount = 0;
    let skippedCount  = 0;
    const usedNames   = new Set();

    for (const { filePath, friendlyName } of pdfFiles) {
      if (!filePath || !fs.existsSync(filePath)) {
        console.warn('[bulkZip] Skipping missing file:', filePath || '(no path)');
        skippedCount += 1;
        continue;
      }

      const entryName = resolveEntryName(friendlyName, filePath, usedNames);
      archive.file(filePath, { name: entryName });
      includedCount += 1;
    }

    if (includedCount === 0) {
      // Nothing to archive — abort cleanly before finalizing.
      archive.abort();
      output.destroy();
      // Remove the empty file left by createWriteStream.
      try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
      return safeReject(new Error('No valid PDF files were available to include in the ZIP.'));
    }

    archive.finalize();
  });
}

module.exports = { createBulkZip, ensureZipStorageDir, buildZipFileName, ZIP_STORAGE_ROOT };
