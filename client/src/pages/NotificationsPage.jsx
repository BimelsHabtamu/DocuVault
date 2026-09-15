/**
 * NotificationsPage — /notifications
 * All-roles page: shows the current user's notifications with All/Read/Unread tabs.
 * Reuses notificationService (same data as the navbar bell — no duplicate logic).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const TYPE_LABELS = {
  awaiting_your_signature:  'Awaiting your signature',
  your_document_approved:   'Your document was approved',
  your_document_rejected:   'Your document was rejected',
  ownership_rejected_notify:'Recipient rejected your document',
  delivery_confirmed_notify:'Recipient confirmed ownership',
};

function labelFor(n, userId) {
  if (n.notification_type === 'your_document_rejected' && n.generated_by !== userId) {
    return 'A document was rejected';
  }
  return TYPE_LABELS[n.notification_type] || n.notification_type.replace(/_/g, ' ');
}

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TABS = ['All', 'Unread', 'Read'];

export default function NotificationsPage() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState('All');
  const [markingAll, setMarkingAll]       = useState(false);

  const load = () => {
    notificationService.getAll()
      .then((res) => setNotifications(res.data || []))
      .catch(() => showToast('Failed to load notifications.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = notifications.filter((n) => {
    if (tab === 'Unread') return !n.is_read;
    if (tab === 'Read')   return !!n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markOne = async (n) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((x) => x === n ? { ...x, is_read: true } : x));
    try {
      await notificationService.markRead(n.notification_type, n.id);
    } catch {
      // roll back
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: false } : x));
      showToast('Could not mark as read.', 'error');
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (!unread.length) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await Promise.all(unread.map((n) => notificationService.markRead(n.notification_type, n.id)));
    } catch {
      showToast('Some notifications could not be marked as read.', 'error');
      load(); // re-fetch to get accurate state
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = async (n) => {
    await markOne(n);
    if (n.notification_type === 'ownership_rejected_notify') {
      navigate(`/document-tracking?doc=${encodeURIComponent(n.doc_id)}&action=view_rejection`);
    } else if (n.doc_id) {
      navigate(`/document-tracking?doc=${encodeURIComponent(n.doc_id)}`);
    }
  };

  return (
    <div className="notif-page">
      {/* Header */}
      <div className="notif-page-header">
        <div>
          <h1 className="notif-page-title">Notifications</h1>
          {unreadCount > 0 && (
            <span className="notif-page-badge">{unreadCount} unread</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notif-page-mark-all"
            onClick={markAllRead}
            disabled={markingAll}
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="notif-page-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`notif-page-tab${tab === t ? ' notif-page-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'Unread' && unreadCount > 0 && (
              <span className="notif-page-tab-count">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="notif-page-empty">Loading notifications…</div>
      ) : filtered.length === 0 ? (
        <div className="notif-page-empty">
          {tab === 'Unread' ? 'No unread notifications.' : tab === 'Read' ? 'No read notifications yet.' : 'No notifications yet.'}
        </div>
      ) : (
        <div className="notif-page-list">
          {filtered.map((n) => (
            <button
              key={`${n.notification_type}-${n.id}`}
              type="button"
              className={`notif-page-item${n.is_read ? ' notif-page-item-read' : ''}`}
              onClick={() => handleClick(n)}
            >
              <div className="notif-page-item-left">
                {!n.is_read && <span className="notif-page-dot" aria-hidden="true" />}
              </div>
              <div className="notif-page-item-body">
                <div className="notif-page-item-label">{labelFor(n, user?.id)}</div>
                {n.doc_uuid && (
                  <div className="notif-page-item-doc">Doc: <code>{n.doc_uuid}</code></div>
                )}
                {n.notification_type === 'ownership_rejected_notify' && (() => {
                  try {
                    const d = typeof n.action_details === 'string' ? JSON.parse(n.action_details) : n.action_details;
                    return d?.reason ? (
                      <div className="notif-page-item-reason">Reason: {d.reason}</div>
                    ) : null;
                  } catch { return null; }
                })()}
                <div className="notif-page-item-time">{relativeTime(n.timestamp)}</div>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  className="notif-page-item-markread"
                  title="Mark as read"
                  onClick={(e) => { e.stopPropagation(); markOne(n); }}
                >
                  ✓
                </button>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
