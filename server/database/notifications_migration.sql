-- ============================================================
-- Notifications Migration
-- Creates a persistent notifications table for the bell icon.
-- Replaces the current in-memory approach in notificationController
-- which only reads live data from signature_requests/audit_logs.
-- ============================================================

USE pdf_engine_db;

-- ────────────────────────────────────────────────────────────
-- 1. notifications table
--    One row per notification per user.
--    type values:
--      'download'   — recipient downloaded a document (→ super admins)
--      'approval'   — signature request assigned (→ approver)
--      'signed'     — document was signed (→ generator)
--      'rejected'   — document was rejected (→ generator)
--      'delivered'  — document delivered to recipient (→ generator)
--      'system'     — generic system messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  type       VARCHAR(50)  NOT NULL DEFAULT 'system',
  title      VARCHAR(255) NOT NULL,
  body       TEXT         NOT NULL,
  link       VARCHAR(500) DEFAULT NULL,
  doc_uuid   VARCHAR(100) DEFAULT NULL,   -- quick reference, no FK (doc may be deleted)
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast per-user lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications (user_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 2. notifications — add MARK ALL READ endpoint support
--    No extra columns needed; is_read=0/1 is sufficient.
--    The app will support:
--      GET  /api/notifications          → unread + recent
--      POST /api/notifications/read/:id → mark one read
--      POST /api/notifications/read-all → mark all read
-- ────────────────────────────────────────────────────────────

-- Done
SELECT 'Notifications migration complete' AS result;
