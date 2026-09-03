/**
 * FR-019: Bulk document generation background job service.
 *
 * Flow:
 *   1. POST /api/documents/bulk  → enqueueBulkJob() creates a bulk_jobs row + starts async processing
 *   2. processBulkJob()          → iterates records, generates each PDF, updates progress
 *   3. GET /api/documents/bulk/:jobUuid → returns current progress from bulk_jobs table
 *   4. GET /api/documents/bulk/:jobUuid/download → streams the zip when status = 'done'
 */

const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const db    = require('../config/db');
const { generatePDF, renderTemplate, MAX_PDF_BYTES } = require('./pdfService');

const PDF_DIR = path.join(__dirname, '../storage/pdfs');
const ZIP_DIR = path.join(__dirname, '../storage/zips');

// Ensure zip storage directory exists
if (!fs.existsSync(ZIP_DIR)) fs.mkdirSync(ZIP_DIR, { recursive: true });

// ── Enqueue a new bulk job ───────────────────────────────────────────────────
async function enqueueBulkJob({ templateId, records, generatedBy, verifyBaseUrl }) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('records must be a non-empty array');
  }

  const [templateRows] = await db.query(
    'SELECT * FROM templates WHERE id = ? AND is_active = 1',
    [templateId]
  );
  if (templateRows.length === 0) throw new Error('Template not found or archived');

  const jobUuid = `BULK-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${uuidv4().slice(0,6).toUpperCase()}`;

  const [result] = await db.query(
    `INSERT INTO bulk_jobs (job_uuid, template_id, created_by, total, status)
     VALUES (?, ?, ?, ?, 'queued')`,
    [jobUuid, templateId, generatedBy, records.length]
  );

  const jobId = result.insertId;

  // Run asynchronously — don't await so the HTTP response returns immediately
  setImmediate(() => processBulkJob(jobId, jobUuid, templateRows[0], records, generatedBy, verifyBaseUrl));

  return { jobUuid, jobId, total: records.length };
}

// ── Process the bulk job in the background ───────────────────────────────────
async function processBulkJob(jobId, jobUuid, template, records, generatedBy, verifyBaseUrl) {
  await db.query("UPDATE bulk_jobs SET status = 'processing' WHERE id = ?", [jobId]);

  const generatedPaths = [];
  const errorLog       = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    // record can be { record_identifier, data: {} } or just a plain data object
    const recordId  = record.record_identifier || record.id || `REC-${i + 1}`;
    const data      = record.data || record;
    const dateStr   = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const safeName  = template.name.replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);
    const docUuid   = `DOC-${dateStr}-${uuidv4().slice(0,6).toUpperCase()}`;
    const fileName  = `${safeName}_${recordId}_${dateStr}.pdf`;

    try {
      const { filePath, hash, buffer } = await generatePDF(template, data, docUuid, verifyBaseUrl, PDF_DIR, 'draft', { db });

      // BR-002: Skip this document if the generated PDF exceeds 5 MB
      if (buffer.length > MAX_PDF_BYTES) {
        try { fs.unlinkSync(filePath); } catch { /* best-effort */ }
        throw new Error(`PDF size ${(buffer.length / 1024 / 1024).toFixed(2)} MB exceeds 5 MB limit (BR-002)`);
      }

      // Rename to human-readable filename
      const namedPath = path.join(PDF_DIR, fileName);
      fs.renameSync(filePath, namedPath);

      const relativePath = path.relative(path.join(__dirname, '..'), namedPath);

      // Insert into generated_docs
      const [docResult] = await db.query(
        `INSERT INTO generated_docs
           (doc_uuid, template_id, template_version, generated_by, record_identifier, file_path, file_hash, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [docUuid, template.id, template.version, generatedBy, recordId, relativePath, hash, JSON.stringify(data)]
      );

      await db.query(
        `INSERT INTO audit_logs (user_id, doc_id, action, action_details, ip_address, user_agent)
         VALUES (?, ?, 'BULK_GENERATE', ?, '0.0.0.0', 'BulkJobService')`,
        [generatedBy, docResult.insertId, JSON.stringify({ jobUuid, record_identifier: recordId })]
      );

      generatedPaths.push({ filePath: namedPath, fileName });

      // Update progress after each successful generation
      await db.query(
        'UPDATE bulk_jobs SET completed = completed + 1 WHERE id = ?',
        [jobId]
      );
    } catch (err) {
      errorLog.push({ recordId, error: err.message });
      await db.query(
        'UPDATE bulk_jobs SET failed = failed + 1 WHERE id = ?',
        [jobId]
      );
    }
  }

  // ── Zip all generated PDFs ─────────────────────────────────────────────────
  const zipPath = path.join(ZIP_DIR, `${jobUuid}.zip`);
  try {
    await zipFiles(generatedPaths, zipPath);
    const relativeZip = path.relative(path.join(__dirname, '..'), zipPath);
    await db.query(
      `UPDATE bulk_jobs SET status = 'done', zip_path = ?, error_log = ? WHERE id = ?`,
      [relativeZip, JSON.stringify(errorLog), jobId]
    );
    console.log(`[BulkJob] ${jobUuid} done — ${generatedPaths.length} generated, ${errorLog.length} failed`);
  } catch (zipErr) {
    await db.query(
      `UPDATE bulk_jobs SET status = 'error', error_log = ? WHERE id = ?`,
      [JSON.stringify([...errorLog, { error: `Zip failed: ${zipErr.message}` }]), jobId]
    );
    console.error(`[BulkJob] ${jobUuid} zip error:`, zipErr.message);
  }
}

// ── Get job progress ─────────────────────────────────────────────────────────
async function getJobProgress(jobUuid) {
  const [rows] = await db.query(
    `SELECT bj.*, t.name AS template_name, u.full_name AS created_by_name
     FROM bulk_jobs bj
     JOIN templates t ON t.id = bj.template_id
     JOIN users u ON u.id = bj.created_by
     WHERE bj.job_uuid = ?`,
    [jobUuid]
  );
  if (rows.length === 0) return null;
  const job = rows[0];
  return {
    jobUuid:     job.job_uuid,
    status:      job.status,
    total:       job.total,
    completed:   job.completed,
    failed:      job.failed,
    percent:     job.total > 0 ? Math.round(((job.completed + job.failed) / job.total) * 100) : 0,
    template:    job.template_name,
    createdBy:   job.created_by_name,
    createdAt:   job.created_at,
    updatedAt:   job.updated_at,
    errorLog:    job.error_log || [],
    downloadReady: job.status === 'done' && !!job.zip_path,
  };
}

// ── Zip helper ────────────────────────────────────────────────────────────────
function zipFiles(files, outputPath) {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (const { filePath, fileName } of files) {
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: fileName });
      }
    }
    archive.finalize();
  });
}

module.exports = { enqueueBulkJob, getJobProgress };
