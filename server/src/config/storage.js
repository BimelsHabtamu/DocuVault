const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Single source of truth for every on-disk path the app writes to.
 *
 * Why this exists: the storage locations used to be hardcoded as
 * `path.join(__dirname, '..', '..', 'storage', '<sub>')` in nine separate files
 * (app.js, auditController, uploadController, bulkZipService, emailService,
 * fileStorage). That works fine locally, but on a PaaS host like Render the
 * container filesystem is ephemeral — every deploy/restart spins up a fresh
 * container and the whole `storage/` tree is wiped, while the MySQL rows in
 * `generated_docs.file_path` keep pointing at the now-missing PDFs. The result
 * is a backend that boots cleanly and then 500s on every download and every
 * document verification.
 *
 * The fix is to let the root be redirected with the STORAGE_ROOT env var and
 * point it at a mounted persistent disk in production. When STORAGE_ROOT is
 * unset the paths resolve exactly as they always have, so local development
 * and the existing committed data are untouched.
 *
 * IMPORTANT: a disk is per-instance state. A service scaled to 2+ instances
 * would give each instance its own copy of these files, so bulk-PDF workers and
 * download requests can land on different machines that don't see each other's
 * writes. Keep the service at exactly one instance while using a disk.
 */
const DEFAULT_STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage');

const STORAGE_ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : DEFAULT_STORAGE_ROOT;

/** Every subdirectory the app expects to exist, keyed by purpose. */
const STORAGE_DIRS = {
  generatedDocs: path.join(STORAGE_ROOT, 'generated-docs'),
  logos: path.join(STORAGE_ROOT, 'logos'),
  avatars: path.join(STORAGE_ROOT, 'avatars'),
  seal: path.join(STORAGE_ROOT, 'seal'),
  authsig: path.join(STORAGE_ROOT, 'authsig'),
  bulkZips: path.join(STORAGE_ROOT, 'bulk-zips'),
  archive: path.join(STORAGE_ROOT, 'archive'),
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Creates every storage subdirectory if missing. Safe to call on every boot. */
function ensureAllStorageDirs() {
  ensureDir(STORAGE_ROOT);
  for (const dir of Object.values(STORAGE_DIRS)) {
    ensureDir(dir);
  }
  return STORAGE_DIRS;
}

module.exports = {
  STORAGE_ROOT,
  STORAGE_DIRS,
  ensureDir,
  ensureAllStorageDirs,
};
