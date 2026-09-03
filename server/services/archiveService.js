/**
 * FR-040 — Document Archive Service
 *
 * Automatically moves documents older than 2 years from normal file storage
 * to a cold-storage directory on the file system.
 *
 * Rules:
 *   • Only documents with status NOT already 'archived' are processed.
 *   • The physical PDF is moved (fs.renameSync → fs.copyFileSync + unlink as fallback).
 *   • The database record is NEVER deleted.
 *   • generated_docs.status    → 'archived'
 *   • generated_docs.archived_at → NOW()
 *   • generated_docs.archive_path → new relative path inside cold-storage/
 *   • An audit_log row with action 'ARCHIVE' is inserted for each document.
 *   • Safe to run repeatedly: documents already archived are skipped.
 *   • Missing source files are logged and skipped gracefully.
 *   • Runs immediately on startup, then once every 24 hours.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const db   = require('../config/db');

// ── Directory constants ───────────────────────────────────────────────────────
// COLD_STORAGE_DIR is absolute; COLD_STORAGE_REL is the prefix stored in DB.
const SERVER_ROOT     = path.join(__dirname, '..');
const COLD_STORAGE_DIR = path.join(SERVER_ROOT, 'storage', 'archive');
const COLD_STORAGE_REL = 'storage/archive'; // prefix for archive_path in DB

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000; // ~63,115,200,000 ms

// ── Ensure cold-storage directory exists ────────────────────────────────────
function ensureArchiveDir() {
  if (!fs.existsSync(COLD_STORAGE_DIR)) {
    fs.mkdirSync(COLD_STORAGE_DIR, { recursive: true });
    console.log('[Archive] Created cold-storage directory:', COLD_STORAGE_DIR);
  }
}

// ── Move a file, falling back to copy+delete if cross-device rename fails ───
function moveFile(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      // Cross-device link — copy then delete
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    } else {
      throw err;
    }
  }
}

// ── Archive a single document row ────────────────────────────────────────────
async function archiveDocument(doc) {
  const docLabel = `doc id=${doc.id} uuid=${doc.doc_uuid}`;

  // ── Resolve source path ─────────────────────────────────────────────────
  if (!doc.file_path) {
    console.warn(`[Archive] Skipping ${docLabel} — no file_path recorded`);
    return { skipped: true, reason: 'no_file_path' };
  }

  const srcAbs = path.join(SERVER_ROOT, doc.file_path);

  if (!fs.existsSync(srcAbs)) {
    // File already missing from disk — update DB so we don't retry forever,
    // but mark archive_path as null to signal the file was absent.
    console.warn(`[Archive] Source file missing for ${docLabel}: ${srcAbs}`);
    await db.query(
      `UPDATE generated_docs
       SET status = 'archived', archived_at = NOW(), archive_path = NULL
       WHERE id = ?`,
      [doc.id]
    );
    await db.query(
      `INSERT INTO audit_logs
         (user_id, doc_id, action, action_details, ip_address, user_agent)
       VALUES (NULL, ?, 'ARCHIVE', ?, 'system', 'archiveService/FR-040')`,
      [
        doc.id,
        JSON.stringify({
          reason:         'auto_archive_FR040',
          note:           'Source file was missing at archive time',
          original_path:  doc.file_path,
          archive_path:   null,
          archived_at:    new Date().toISOString(),
        }),
      ]
    );
    return { skipped: false, missing: true };
  }

  // ── Build destination path ──────────────────────────────────────────────
  // Preserve the original filename inside the archive directory.
  const fileName = path.basename(doc.file_path);
  const destAbs  = path.join(COLD_STORAGE_DIR, fileName);
  const destRel  = `${COLD_STORAGE_REL}/${fileName}`;

  // If a file with the same name already exists in the archive, suffix with doc id
  const finalDestAbs = fs.existsSync(destAbs)
    ? path.join(COLD_STORAGE_DIR, `${doc.id}_${fileName}`)
    : destAbs;
  const finalDestRel = fs.existsSync(destAbs)
    ? `${COLD_STORAGE_REL}/${doc.id}_${fileName}`
    : destRel;

  // ── Move file ───────────────────────────────────────────────────────────
  moveFile(srcAbs, finalDestAbs);
  console.log(`[Archive] Moved ${docLabel} → ${finalDestRel}`);

  // ── Update database ─────────────────────────────────────────────────────
  await db.query(
    `UPDATE generated_docs
     SET status = 'archived', archived_at = NOW(), archive_path = ?
     WHERE id = ?`,
    [finalDestRel, doc.id]
  );

  // ── Audit log ───────────────────────────────────────────────────────────
  await db.query(
    `INSERT INTO audit_logs
       (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (NULL, ?, 'ARCHIVE', ?, 'system', 'archiveService/FR-040')`,
    [
      doc.id,
      JSON.stringify({
        reason:        'auto_archive_FR040',
        original_path: doc.file_path,
        archive_path:  finalDestRel,
        archived_at:   new Date().toISOString(),
        policy:        'documents_older_than_2_years',
      }),
    ]
  );

  return { skipped: false, archived: true, dest: finalDestRel };
}

// ── Main archive run ──────────────────────────────────────────────────────────
async function runArchiveJob() {
  console.log('[Archive] FR-040 archive job starting…');

  ensureArchiveDir();

  const cutoff = new Date(Date.now() - TWO_YEARS_MS);
  const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');

  // Fetch all candidates: generated more than 2 years ago, not yet archived.
  // Excludes rows where file_path is already NULL (nothing to move).
  const [candidates] = await db.query(
    `SELECT id, doc_uuid, file_path, archive_path
     FROM generated_docs
     WHERE generated_at < ?
       AND status != 'archived'
     ORDER BY generated_at ASC`,
    [cutoffStr]
  );

  if (candidates.length === 0) {
    console.log('[Archive] No documents eligible for archiving.');
    return;
  }

  console.log(`[Archive] Found ${candidates.length} document(s) older than 2 years.`);

  let archived  = 0;
  let skipped   = 0;
  let missing   = 0;
  let errors    = 0;

  for (const doc of candidates) {
    try {
      const result = await archiveDocument(doc);
      if (result.skipped)  skipped++;
      else if (result.missing) missing++;
      else archived++;
    } catch (err) {
      errors++;
      console.error(
        `[Archive] ERROR archiving doc id=${doc.id} uuid=${doc.doc_uuid}:`,
        err.message
      );
      // Continue processing remaining documents — don't abort the whole run
    }
  }

  console.log(
    `[Archive] Run complete — archived: ${archived}, ` +
    `missing: ${missing}, skipped: ${skipped}, errors: ${errors}`
  );
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function startArchiveJob() {
  console.log('[Archive] FR-040 archive job scheduled — runs every 24 hours');

  // Run immediately on startup so we don't wait 24h on first deploy
  runArchiveJob().catch(err =>
    console.error('[Archive] Startup run failed:', err.message)
  );

  // Then repeat every 24 hours
  setInterval(() => {
    runArchiveJob().catch(err =>
      console.error('[Archive] Scheduled run failed:', err.message)
    );
  }, INTERVAL_MS);
}

module.exports = { startArchiveJob, runArchiveJob };
