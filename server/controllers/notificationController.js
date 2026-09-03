const db = require('../config/db');

// ── GET /api/notifications ────────────────────────────────────────────────────
// Returns the most recent notifications for the logged-in user.
// Sources:
//   1. Persistent `notifications` table (download alerts for admins, etc.)
//   2. Live pending signature requests (for approvers)
//   3. Recent audit log activity (for all users)
exports.getNotifications = async (req, res) => {
  const userId = req.user.id;
  const role   = req.user.role;
  const items  = [];

  // ── Source 1: Persistent notifications from DB ───────────────────────────
  const [dbNotifs] = await db.query(
    `SELECT id, type, title AS text, body, link, doc_uuid, is_read, created_at AS time
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );
  dbNotifs.forEach(n => {
    items.push({
      id:     `notif-${n.id}`,
      type:   n.type,
      text:   n.text,
      body:   n.body,
      time:   n.time,
      unread: n.is_read === 0,
      link:   n.link || '/dashboard',
      doc_uuid: n.doc_uuid,
    });
  });

  // ── Source 2: Live pending signature requests (approver + all admin roles) ─
  // Fix: was checking role === 'admin' which never matched; now covers all admin roles
  const isApproverOrAdmin = ['approver', 'super_admin', 'system_admin'].includes(role);
  if (isApproverOrAdmin) {
    // Approvers only see requests assigned to them.
    // Admins see ALL pending requests (they can approve any document).
    const isAdmin = role === 'super_admin' || role === 'system_admin';
    const [pending] = isAdmin
      ? await db.query(
          `SELECT sr.id, gd.doc_uuid, u.full_name AS generator_name,
                  a.full_name AS approver_name, sr.created_at
           FROM signature_requests sr
           JOIN generated_docs gd ON gd.id = sr.doc_id
           JOIN users u ON u.id = gd.generated_by
           JOIN users a ON a.id = sr.approver_id
           WHERE sr.status = 'pending'
           ORDER BY sr.created_at DESC
           LIMIT 5`
        )
      : await db.query(
          `SELECT sr.id, gd.doc_uuid, u.full_name AS generator_name, sr.created_at
           FROM signature_requests sr
           JOIN generated_docs gd ON gd.id = sr.doc_id
           JOIN users u ON u.id = gd.generated_by
           WHERE sr.approver_id = ? AND sr.status = 'pending'
           ORDER BY sr.created_at DESC
           LIMIT 5`,
          [userId]
        );
    pending.forEach(r => {
      const label = r.approver_name ? ` (assigned to ${r.approver_name})` : '';
      items.push({
        id:     `sign-${r.id}`,
        type:   'approval',
        text:   `${r.generator_name} requested signature on ${r.doc_uuid}${label}`,
        time:   r.created_at,
        unread: true,
        link:   '/approvals',
        doc_uuid: r.doc_uuid,
      });
    });
  }

  // ── Source 3: Recent audit activity (all roles) ───────────────────────────
  const [recent] = await db.query(
    `SELECT al.id, al.action, al.timestamp, gd.doc_uuid
     FROM audit_logs al
     LEFT JOIN generated_docs gd ON gd.id = al.doc_id
     WHERE al.user_id = ?
     ORDER BY al.timestamp DESC
     LIMIT 5`,
    [userId]
  );

  const actionLabels = {
    GENERATE:      'You generated document',
    SIGN:          'Signature action on',
    DELIVER:       'You delivered document',
    VERIFY:        'You verified document',
    PREVIEW:       'You previewed document',
    DOWNLOAD:      'You downloaded document',
    BULK_GENERATE: 'Bulk generation completed',
  };

  recent.forEach(r => {
    items.push({
      id:     `audit-${r.id}`,
      type:   'activity',
      text:   `${actionLabels[r.action] || r.action} ${r.doc_uuid || ''}`.trim(),
      time:   r.timestamp,
      unread: false,
      link:   '/audit',
    });
  });

  // Sort all sources by time desc, return max 10
  items.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(items.slice(0, 10));
};

// ── POST /api/notifications/read/:id ─────────────────────────────────────────
// Marks a single persistent notification as read.
exports.markRead = async (req, res) => {
  const { id } = req.params;
  await db.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );
  res.json({ message: 'Notification marked as read' });
};

// ── POST /api/notifications/read-all ─────────────────────────────────────────
// Marks all persistent notifications for this user as read.
exports.markAllRead = async (req, res) => {
  await db.query(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [req.user.id]
  );
  res.json({ message: 'All notifications marked as read' });
};

// ── GET /api/notifications/unread-count ──────────────────────────────────────
// Quick badge count for the bell icon — only counts persistent notifications.
exports.getUnreadCount = async (req, res) => {
  const [[row]] = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  res.json({ count: Number(row.count) });
};
