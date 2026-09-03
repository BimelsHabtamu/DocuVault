const db = require('../config/db');

exports.getAuditTrail = async (req, res) => {
  const { doc_id } = req.params;
  const [rows] = await db.query(
    `SELECT al.*, u.full_name AS user_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE al.doc_id = ?
     ORDER BY al.timestamp ASC`,
    [doc_id]
  );
  res.json(rows);
};

exports.getDashboard = async (req, res) => {
  const userId = req.user.id;
  const role   = req.user.role;

  const isAdmin     = role === 'super_admin' || role === 'system_admin';
  const isApprover  = role === 'approver';
  const isGenerator = role === 'generator';

  const [[docsToday]] = isAdmin
    ? await db.query(`SELECT COUNT(*) AS count FROM generated_docs WHERE DATE(generated_at) = CURDATE()`)
    : await db.query(`SELECT COUNT(*) AS count FROM generated_docs WHERE DATE(generated_at) = CURDATE() AND generated_by = ?`, [userId]);

  const [[pendingApprovals]] = isAdmin
    ? await db.query(`SELECT COUNT(*) AS count FROM signature_requests WHERE status = 'pending'`)
    : isApprover
      ? await db.query(`SELECT COUNT(*) AS count FROM signature_requests WHERE status = 'pending' AND approver_id = ?`, [userId])
      : [[ { count: null } ]];

  const [[totalDocs]] = (isAdmin || isGenerator)
    ? isAdmin
      ? await db.query(`SELECT COUNT(*) AS count FROM generated_docs`)
      : await db.query(`SELECT COUNT(*) AS count FROM generated_docs WHERE generated_by = ?`, [userId])
    : [[ { count: null } ]];

  const [[activeUsers]] = isAdmin
    ? await db.query(`SELECT COUNT(*) AS count FROM users WHERE is_active = 1`)
    : [[ { count: null } ]];

  const [statusBreakdown] = (isAdmin || isGenerator)
    ? isAdmin
      ? await db.query(`SELECT status, COUNT(*) AS count FROM generated_docs GROUP BY status`)
      : await db.query(`SELECT status, COUNT(*) AS count FROM generated_docs WHERE generated_by = ? GROUP BY status`, [userId])
    : [ [] ];

  const [topTemplates] = (isAdmin || isGenerator)
    ? await db.query(
        `SELECT t.name, t.category, COUNT(gd.id) AS usage_count
         FROM generated_docs gd
         JOIN templates t ON t.id = gd.template_id
         ${isAdmin ? '' : 'WHERE gd.generated_by = ?'}
         GROUP BY t.id, t.name, t.category
         ORDER BY usage_count DESC LIMIT 5`,
        isAdmin ? [] : [userId]
      )
    : [ [] ];

  const [[avgApproval]] = await db.query(
    `SELECT AVG(TIMESTAMPDIFF(MINUTE, sr.created_at, sr.approved_at)) AS avg_minutes
     FROM signature_requests sr
     WHERE sr.status = 'approved' AND sr.approved_at IS NOT NULL
     ${isApprover ? 'AND sr.approver_id = ?' : ''}`,
    isApprover ? [userId] : []
  );

  const [recentActivity] = await db.query(
    `SELECT al.action, al.timestamp, al.ip_address, gd.doc_uuid, u.full_name AS user_name
     FROM audit_logs al
     LEFT JOIN generated_docs gd ON gd.id = al.doc_id
     LEFT JOIN users u ON u.id = al.user_id
     ${isAdmin ? '' : 'WHERE al.user_id = ?'}
     ORDER BY al.timestamp DESC LIMIT 8`,
    isAdmin ? [] : [userId]
  );

  const [deliveryStats] = (isAdmin || isGenerator)
    ? await db.query(`SELECT email_status, COUNT(*) AS count FROM delivery_logs GROUP BY email_status`)
    : [ [] ];

  res.json({
    docs_today:           docsToday.count,
    pending_approvals:    pendingApprovals.count,
    total_docs:           totalDocs.count,
    active_users:         activeUsers.count,
    status_breakdown:     statusBreakdown,
    top_templates:        topTemplates,
    avg_approval_minutes: avgApproval.avg_minutes ? Math.round(avgApproval.avg_minutes) : null,
    recent_activity:      recentActivity,
    delivery_stats:       deliveryStats,
  });
};

exports.searchDocuments = async (req, res) => {
  const { template_id, status, generated_by, from_date, to_date } = req.query;

  let query  = `SELECT gd.*, t.name AS template_name, u.full_name AS generated_by_name
                FROM generated_docs gd
                JOIN templates t ON t.id = gd.template_id
                JOIN users u ON u.id = gd.generated_by
                WHERE 1=1`;
  const params = [];

  if (template_id) { query += ' AND gd.template_id = ?'; params.push(template_id); }
  if (status)      { query += ' AND gd.status = ?';      params.push(status); }
  if (generated_by){ query += ' AND gd.generated_by = ?';params.push(generated_by); }
  if (from_date)   { query += ' AND DATE(gd.generated_at) >= ?'; params.push(from_date); }
  if (to_date)     { query += ' AND DATE(gd.generated_at) <= ?'; params.push(to_date); }

  query += ' ORDER BY gd.generated_at DESC';

  const [rows] = await db.query(query, params);
  res.json(rows);
};

exports.getAllAuditLogs = async (req, res) => {
  const { action, user_id, approver_id, from_date, to_date } = req.query;

  // Base query — always joins users for the actor name
  let query  = `SELECT al.*, u.full_name AS user_name
                FROM audit_logs al
                LEFT JOIN users u ON u.id = al.user_id
                WHERE 1=1`;
  const params = [];

  if (action)    { query += ' AND al.action = ?';            params.push(action); }
  if (user_id)   { query += ' AND al.user_id = ?';           params.push(user_id); }
  if (from_date) { query += ' AND DATE(al.timestamp) >= ?';  params.push(from_date); }
  if (to_date)   { query += ' AND DATE(al.timestamp) <= ?';  params.push(to_date); }

  // FR-039: Approver filter — return all audit events for documents assigned
  // to the selected approver (via signature_requests.approver_id).
  // This covers the full audit trail of those documents, not just SIGN events.
  if (approver_id) {
    query += ` AND al.doc_id IN (
      SELECT DISTINCT sr.doc_id
      FROM signature_requests sr
      WHERE sr.approver_id = ?
    )`;
    params.push(approver_id);
  }

  query += ' ORDER BY al.timestamp DESC LIMIT 500';

  const [rows] = await db.query(query, params);
  res.json(rows);
};

// ── FR-038: CSV export — documents per department / date range ────────────────
exports.exportDocumentsCsv = async (req, res) => {
  const { from_date, to_date, template_id, status, generated_by } = req.query;

  let query = `
    SELECT
      gd.doc_uuid              AS "Document ID",
      t.name                   AS "Template",
      t.category               AS "Category",
      u.full_name              AS "Generated By",
      u.department             AS "Department",
      gd.record_identifier     AS "Record ID",
      gd.status                AS "Status",
      gd.generated_at          AS "Generated At",
      COALESCE(
        (SELECT ds.signature_timestamp
         FROM digital_signatures ds WHERE ds.doc_id = gd.id ORDER BY ds.id DESC LIMIT 1),
        ''
      )                        AS "Signed At",
      COALESCE(
        (SELECT dl.sent_at
         FROM delivery_logs dl WHERE dl.doc_id = gd.id ORDER BY dl.id DESC LIMIT 1),
        ''
      )                        AS "Delivered At"
    FROM generated_docs gd
    JOIN templates t ON t.id = gd.template_id
    JOIN users u ON u.id = gd.generated_by
    WHERE 1=1`;

  const params = [];
  if (template_id)  { query += ' AND gd.template_id = ?';          params.push(template_id); }
  if (status)       { query += ' AND gd.status = ?';               params.push(status); }
  if (generated_by) { query += ' AND gd.generated_by = ?';         params.push(generated_by); }
  if (from_date)    { query += ' AND DATE(gd.generated_at) >= ?';  params.push(from_date); }
  if (to_date)      { query += ' AND DATE(gd.generated_at) <= ?';  params.push(to_date); }

  query += ' ORDER BY gd.generated_at DESC';

  const [rows] = await db.query(query, params);

  if (rows.length === 0) {
    return res.status(404).json({ message: 'No documents found for the given filters' });
  }

  // Build CSV manually — no extra dependency needed
  const headers = Object.keys(rows[0]);
  const escape  = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v).replace(/"/g, '""');
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
  };

  const csvLines = [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ];

  const csv = csvLines.join('\r\n');
  const now = new Date().toISOString().slice(0, 10);
  const filename = `docuvault-export-${now}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv); // UTF-8 BOM so Excel opens Amharic text correctly
};

// ── GET /api/audit/activity-chart ─────────────────────────────────────────────
// Returns per-day counts for the last 7 days (today inclusive):
//   generated — rows inserted into generated_docs
//   signed    — signature_requests approved
//   delivered — rows inserted into delivery_logs
// Response shape:
//   [{ date: "2026-08-23", generated: 4, signed: 2, delivered: 3 }, ...]
// Dates with zero activity are still included so the chart always has 7 points.
exports.getActivityChart = async (req, res) => {
  try {
    // Build the last-7-days date spine in SQL so zeros are explicit
    const [generated] = await db.query(`
      SELECT DATE(generated_at) AS day, COUNT(*) AS cnt
      FROM generated_docs
      WHERE generated_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(generated_at)
    `);

    const [signed] = await db.query(`
      SELECT DATE(approved_at) AS day, COUNT(*) AS cnt
      FROM signature_requests
      WHERE status = 'approved'
        AND approved_at IS NOT NULL
        AND approved_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(approved_at)
    `);

    const [delivered] = await db.query(`
      SELECT DATE(sent_at) AS day, COUNT(*) AS cnt
      FROM delivery_logs
      WHERE sent_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(sent_at)
    `);

    // Build a full 7-day spine (today - 6 … today) and merge the query results
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // Format as YYYY-MM-DD in local time — matches DATE() return from MySQL
      const iso = d.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD
      days.push(iso);
    }

    const toMap = (rows) => {
      const m = {};
      rows.forEach(r => {
        // MySQL DATE() returns a JS Date object when using mysql2 — normalise to string
        const key = r.day instanceof Date
          ? r.day.toLocaleDateString('en-CA')
          : String(r.day).slice(0, 10);
        m[key] = Number(r.cnt);
      });
      return m;
    };

    const genMap  = toMap(generated);
    const sigMap  = toMap(signed);
    const delMap  = toMap(delivered);

    const result = days.map(date => ({
      date,
      generated: genMap[date]  ?? 0,
      signed:    sigMap[date]  ?? 0,
      delivered: delMap[date]  ?? 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load activity chart data', error: err.message });
  }
};

// ── GET /api/audit/reports ────────────────────────────────────────────────────
// Business analytics endpoint for the Reports page.
// Accepts optional query params: from_date, to_date, status, category, template_id
//
// Response shape:
// {
//   kpis: { total, signed, delivered, pending, rejected, draft },
//   status_breakdown:  [{ status, count }],
//   category_breakdown:[{ category, count }],
//   top_templates:     [{ name, category, usage_count }],
//   activity_series:   [{ date, generated, signed, delivered }],   // date range provided
//   date_range:        { from, to }
// }
exports.getReportData = async (req, res) => {
  try {
    const { from_date, to_date, status, category, template_id } = req.query;

    // ── Build the shared WHERE clause for generated_docs ──────────────────
    let where = 'WHERE 1=1';
    const p   = [];

    if (from_date)   { where += ' AND DATE(gd.generated_at) >= ?'; p.push(from_date); }
    if (to_date)     { where += ' AND DATE(gd.generated_at) <= ?'; p.push(to_date); }
    if (status)      { where += ' AND gd.status = ?';              p.push(status); }
    if (category)    { where += ' AND t.category = ?';             p.push(category); }
    if (template_id) { where += ' AND gd.template_id = ?';         p.push(template_id); }

    // Reusable base — all these queries join templates so category filter works
    const base = `FROM generated_docs gd JOIN templates t ON t.id = gd.template_id ${where}`;

    // ── KPIs ─────────────────────────────────────────────────────────────
    const [[{ total }]]     = await db.query(`SELECT COUNT(*) AS total ${base}`, p);
    const [[{ signed }]]    = await db.query(`SELECT COUNT(*) AS signed ${base} AND gd.status = 'signed'`,    p);
    const [[{ delivered }]] = await db.query(`SELECT COUNT(*) AS delivered ${base} AND (gd.status = 'delivered' OR gd.status = 'hand_delivered')`, p);
    const [[{ pending }]]   = await db.query(`SELECT COUNT(*) AS pending ${base} AND gd.status = 'pending'`,   p);
    const [[{ rejected }]]  = await db.query(`SELECT COUNT(*) AS rejected ${base} AND gd.status = 'rejected'`, p);
    const [[{ draft }]]     = await db.query(`SELECT COUNT(*) AS draft ${base} AND gd.status = 'draft'`,       p);

    // ── Status breakdown ─────────────────────────────────────────────────
    const [statusBreakdown] = await db.query(
      `SELECT gd.status, COUNT(*) AS count ${base} GROUP BY gd.status ORDER BY count DESC`, p
    );

    // ── Category breakdown ───────────────────────────────────────────────
    const [categoryBreakdown] = await db.query(
      `SELECT COALESCE(t.category, 'Uncategorised') AS category, COUNT(*) AS count
       ${base}
       GROUP BY t.category
       ORDER BY count DESC`, p
    );

    // ── Top 5 templates ──────────────────────────────────────────────────
    const [topTemplates] = await db.query(
      `SELECT t.name, t.category, COUNT(gd.id) AS usage_count
       ${base}
       GROUP BY gd.template_id, t.name, t.category
       ORDER BY usage_count DESC
       LIMIT 5`, p
    );

    // ── Activity series (per-day counts across the filtered date range) ──
    // For each day in range: generated, signed, delivered
    const seriesWhere = [];
    const seriesP     = [];
    if (from_date) { seriesWhere.push('DATE(gd.generated_at) >= ?'); seriesP.push(from_date); }
    if (to_date)   { seriesWhere.push('DATE(gd.generated_at) <= ?'); seriesP.push(to_date); }
    if (category)  { seriesWhere.push('t.category = ?');             seriesP.push(category); }
    if (template_id){ seriesWhere.push('gd.template_id = ?');        seriesP.push(template_id); }

    const seriesClause = seriesWhere.length ? 'WHERE ' + seriesWhere.join(' AND ') : '';

    const [genSeries] = await db.query(
      `SELECT DATE(gd.generated_at) AS day, COUNT(*) AS cnt
       FROM generated_docs gd
       JOIN templates t ON t.id = gd.template_id
       ${seriesClause}
       GROUP BY DATE(gd.generated_at)
       ORDER BY day ASC`, seriesP
    );

    // Signed series uses signature_requests.approved_at — no template filter available
    const signWhere = [];
    const signP     = [];
    if (from_date) { signWhere.push('DATE(sr.approved_at) >= ?'); signP.push(from_date); }
    if (to_date)   { signWhere.push('DATE(sr.approved_at) <= ?'); signP.push(to_date); }
    const signClause = signWhere.length
      ? "WHERE sr.status = 'approved' AND sr.approved_at IS NOT NULL AND " + signWhere.join(' AND ')
      : "WHERE sr.status = 'approved' AND sr.approved_at IS NOT NULL";

    const [signSeries] = await db.query(
      `SELECT DATE(sr.approved_at) AS day, COUNT(*) AS cnt
       FROM signature_requests sr
       ${signClause}
       GROUP BY DATE(sr.approved_at)
       ORDER BY day ASC`, signP
    );

    // Delivery series
    const delWhere = [];
    const delP     = [];
    if (from_date) { delWhere.push('DATE(dl.sent_at) >= ?'); delP.push(from_date); }
    if (to_date)   { delWhere.push('DATE(dl.sent_at) <= ?'); delP.push(to_date); }
    const delClause = delWhere.length ? 'WHERE ' + delWhere.join(' AND ') : '';

    const [delSeries] = await db.query(
      `SELECT DATE(dl.sent_at) AS day, COUNT(*) AS cnt
       FROM delivery_logs dl
       ${delClause}
       GROUP BY DATE(dl.sent_at)
       ORDER BY day ASC`, delP
    );

    // Merge all three series onto a unified date spine
    const toMap = rows => {
      const m = {};
      rows.forEach(r => {
        const key = r.day instanceof Date
          ? r.day.toLocaleDateString('en-CA')
          : String(r.day).slice(0, 10);
        m[key] = Number(r.cnt);
      });
      return m;
    };

    const genMap  = toMap(genSeries);
    const sigMap  = toMap(signSeries);
    const delMap  = toMap(delSeries);

    // Build date spine — use the union of all dates that appear in any series
    const allDates = [...new Set([
      ...Object.keys(genMap),
      ...Object.keys(sigMap),
      ...Object.keys(delMap),
    ])].sort();

    const activitySeries = allDates.map(date => ({
      date,
      generated: genMap[date]  ?? 0,
      signed:    sigMap[date]  ?? 0,
      delivered: delMap[date]  ?? 0,
    }));

    res.json({
      kpis: {
        total:     Number(total),
        signed:    Number(signed),
        delivered: Number(delivered),
        pending:   Number(pending),
        rejected:  Number(rejected),
        draft:     Number(draft),
      },
      status_breakdown:   statusBreakdown.map(r => ({ status: r.status,     count: Number(r.count) })),
      category_breakdown: categoryBreakdown.map(r => ({ category: r.category, count: Number(r.count) })),
      top_templates:      topTemplates.map(r => ({ name: r.name, category: r.category, usage_count: Number(r.usage_count) })),
      activity_series:    activitySeries,
      date_range:         { from: from_date || null, to: to_date || null },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load report data', error: err.message });
  }
};

// ── GET /api/audit/my-activity-chart ─────────────────────────────────────────
// Same shape as /activity-chart but scoped to the calling user's documents only.
// Used by the Generator dashboard to show their personal activity.
// Response: [{ date:"YYYY-MM-DD", generated:n, signed:n, delivered:n }] × 7
exports.getMyActivityChart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Documents generated by this user in the last 7 days
    const [generated] = await db.query(`
      SELECT DATE(generated_at) AS day, COUNT(*) AS cnt
      FROM generated_docs
      WHERE generated_at >= CURDATE() - INTERVAL 6 DAY
        AND generated_by = ?
      GROUP BY DATE(generated_at)
    `, [userId]);

    // Documents generated by this user that were signed in the last 7 days
    const [signed] = await db.query(`
      SELECT DATE(sr.approved_at) AS day, COUNT(*) AS cnt
      FROM signature_requests sr
      JOIN generated_docs gd ON gd.id = sr.doc_id
      WHERE sr.status = 'approved'
        AND sr.approved_at IS NOT NULL
        AND sr.approved_at >= CURDATE() - INTERVAL 6 DAY
        AND gd.generated_by = ?
      GROUP BY DATE(sr.approved_at)
    `, [userId]);

    // Documents generated by this user that were delivered in the last 7 days
    const [delivered] = await db.query(`
      SELECT DATE(dl.sent_at) AS day, COUNT(*) AS cnt
      FROM delivery_logs dl
      JOIN generated_docs gd ON gd.id = dl.doc_id
      WHERE dl.sent_at >= CURDATE() - INTERVAL 6 DAY
        AND gd.generated_by = ?
      GROUP BY DATE(dl.sent_at)
    `, [userId]);

    // Build full 7-day spine so every day appears even with zero counts
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-CA')); // YYYY-MM-DD
    }

    const toMap = rows => {
      const m = {};
      rows.forEach(r => {
        const key = r.day instanceof Date
          ? r.day.toLocaleDateString('en-CA')
          : String(r.day).slice(0, 10);
        m[key] = Number(r.cnt);
      });
      return m;
    };

    const genMap = toMap(generated);
    const sigMap = toMap(signed);
    const delMap = toMap(delivered);

    const result = days.map(date => ({
      date,
      generated: genMap[date] ?? 0,
      signed:    sigMap[date] ?? 0,
      delivered: delMap[date] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load activity chart', error: err.message });
  }
};
