/**
 * datasourceController.js — FR-009 (Option A: users table)
 *
 * Security model:
 *   - Only db_table = 'users' is allowed. All other table names are rejected
 *     regardless of what is stored in field_mappings — prevents injection if
 *     a bad mapping row were ever inserted.
 *   - Only the columns in SAFE_USER_COLUMNS may be returned. Sensitive columns
 *     (password_hash, password_set, notification_email, session_timeout_minutes,
 *     avatar_url, signature_url, email_verified_at, theme, language) are never
 *     returned even if a mapping row referenced them.
 *   - The frontend sends only a user ID or a search term — never a table name,
 *     column name, or SQL fragment.
 *   - All SQL uses parameterised queries.
 */

const db = require('../config/db');

// ── Allowlist: only these users columns may ever be returned ──────────────────
const SAFE_USER_COLUMNS = new Set([
  'id', 'full_name', 'email', 'phone', 'role', 'department', 'created_at',
]);

// ── Only this source table is supported in this implementation ────────────────
const ALLOWED_SOURCE = 'users';

// ── GET /api/datasource/:templateId/fetch/:userId ─────────────────────────────
// Fetches the mapped fields for a given user and template.
// Returns ONLY the placeholder keys the template needs, with values from users.
// Sensitive columns are never returned.
exports.fetchRecord = async (req, res) => {
  const { templateId, userId } = req.params;

  // 1. Load the template and confirm data_source
  const [tmplRows] = await db.query(
    'SELECT id, data_source FROM templates WHERE id = ?',
    [templateId]
  );
  if (tmplRows.length === 0) {
    return res.status(404).json({ message: 'Template not found' });
  }
  if (tmplRows[0].data_source !== ALLOWED_SOURCE) {
    return res.status(400).json({
      message: `This template does not use a supported data source (got: "${tmplRows[0].data_source || 'none'}").`,
    });
  }

  // 2. Load the field mappings for this template
  const [mappings] = await db.query(
    `SELECT static_field_key, db_table, db_column
     FROM field_mappings
     WHERE template_id = ? AND is_active = 1`,
    [templateId]
  );
  if (mappings.length === 0) {
    return res.status(404).json({ message: 'No field mappings configured for this template.' });
  }

  // 3. Security: enforce table allowlist and column allowlist
  const safeMappings = mappings.filter(m => {
    if (m.db_table !== ALLOWED_SOURCE) return false;
    if (!SAFE_USER_COLUMNS.has(m.db_column)) return false;
    return true;
  });
  if (safeMappings.length === 0) {
    return res.status(400).json({ message: 'No safe mappings available for this template.' });
  }

  // 4. Fetch the user row — only the specific columns we need
  const columns = [...new Set(safeMappings.map(m => m.db_column))];
  const colList  = columns.map(c => `\`${c}\``).join(', ');

  const [userRows] = await db.query(
    `SELECT ${colList} FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
    [Number(userId)]
  );
  if (userRows.length === 0) {
    return res.status(404).json({
      message: `No active user found with ID ${userId}. Please enter a valid User ID.`,
    });
  }
  const userRow = userRows[0];

  // 5. Build the response: { placeholder_key: value } — only mapped fields
  const populated = {};
  for (const m of safeMappings) {
    const rawValue = userRow[m.db_column];
    // Convert non-strings cleanly (id → string, null → '')
    populated[m.static_field_key] = rawValue != null ? String(rawValue) : '';
  }

  res.json({
    source:    ALLOWED_SOURCE,
    record_id: String(userId),
    populated,
  });
};

// ── GET /api/datasource/:templateId/search?q=... ──────────────────────────────
// Searches users by name or email so the generator can find the right person
// without knowing their internal ID. Returns id + display_label only.
// Max 10 results. Never returns sensitive fields.
exports.searchRecords = async (req, res) => {
  const { templateId } = req.params;
  const q = (req.query.q || '').trim();

  if (!q || q.length < 2) {
    return res.status(400).json({ message: 'Search term must be at least 2 characters.' });
  }

  // Confirm template uses the users data source
  const [tmplRows] = await db.query(
    'SELECT data_source FROM templates WHERE id = ?',
    [templateId]
  );
  if (tmplRows.length === 0) {
    return res.status(404).json({ message: 'Template not found' });
  }
  if (tmplRows[0].data_source !== ALLOWED_SOURCE) {
    return res.status(400).json({ message: 'Template does not use the users data source.' });
  }

  // Return safe subset only — enough for the generator to identify the right person
  const [rows] = await db.query(
    `SELECT id, full_name, email, department, role
     FROM users
     WHERE is_active = 1
       AND (full_name LIKE ? OR email LIKE ?)
     ORDER BY full_name ASC
     LIMIT 10`,
    [`%${q}%`, `%${q}%`]
  );

  res.json(rows.map(r => ({
    id:            r.id,
    display_label: r.full_name,
    email:         r.email,
    department:    r.department || '',
    role:          r.role,
  })));
};

// ── GET /api/datasource/:templateId/mappings ─────────────────────────────────
// Returns the active field mappings for a template so the frontend knows
// which placeholders will be auto-populated vs which need manual input.
exports.getMappings = async (req, res) => {
  const { templateId } = req.params;

  const [rows] = await db.query(
    `SELECT static_field_key, db_table, db_column, mapping_type
     FROM field_mappings
     WHERE template_id = ? AND is_active = 1`,
    [templateId]
  );

  // Only return mappings for the allowed source/columns
  const safe = rows.filter(
    m => m.db_table === ALLOWED_SOURCE && SAFE_USER_COLUMNS.has(m.db_column)
  );

  res.json(safe);
};
