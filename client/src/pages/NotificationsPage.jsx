/** NotificationsPage — /notifications */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();
  const { t }         = useTranslation('layout');

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState('all');
  const [markingAll, setMarkingAll]       = useState(false);

  const TABS = [
    { key: 'all',    label: t('notificationsPage.tabAll') },
    { key: 'unread', label: t('notificationsPage.tabUnread') },
    { key: 'read',   label: t('notificationsPage.tabRead') },
  ];

  // Map notification_type → translated label
  const labelFor = (n) => {
    const TYPE_MAP = {
      awaiting_your_signature:   t('notifications.awaitingYourSignature'),
      your_document_approved:    t('notifications.yourDocumentApproved'),
      your_document_rejected:    n.generated_by !== user?.id
                                   ? t('notifications.aDocumentWasRejected')
                                   : t('notifications.yourDocumentRejected'),
      ownership_rejected_notify: t('notifications.recipientRejectedDocument'),
      delivery_confirmed_notify: t('notifications.recipientConfirmedOwnership'),
    };
    return TYPE_MAP[n.notification_type] || n.notification_type.replace(/_/g, ' ');
  };

  const load = () => {
    notificationService.getAll()
      .then((res) => setNotifications(res.data || []))
      .catch(() => showToast(t('notificationsPage.loadFailed'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = notifications.filter((n) => {
    if (tab === 'unread') return !n.is_read;
    if (tab === 'read')   return !!n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markOne = async (n) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((x) => x === n ? { ...x, is_read: true } : x));
    try {
      await notificationService.markRead(n.notification_type, n.id);
    } catch {
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
      load();
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
          <h1 className="notif-page-title">{t('notificationsPage.title')}</h1>
          {unreadCount > 0 && (
            <span className="notif-page-badge">{unreadCount} {t('notifications.titleUnread', { count: unreadCount }).replace(/.*\(/, '').replace(/\)$/, '')}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notif-page-mark-all"
            onClick={markAllRead}
            disabled={markingAll}
          >
            {markingAll ? '…' : t('notificationsPage.markAllRead')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="notif-page-tabs" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`notif-page-tab${tab === key ? ' notif-page-tab-active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'unread' && unreadCount > 0 && (
              <span className="notif-page-tab-count">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="notif-page-empty">{t('notificationsPage.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="notif-page-empty">{t('notificationsPage.empty')}</div>
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
                <div className="notif-page-item-label">{labelFor(n)}</div>
                {n.doc_uuid && (
                  <div className="notif-page-item-doc">
                    {t('notifications.document')}: <code>{n.doc_uuid}</code>
                  </div>
                )}
                {n.notification_type === 'ownership_rejected_notify' && (() => {
                  try {
                    const d = typeof n.action_details === 'string'
                      ? JSON.parse(n.action_details)
                      : n.action_details;
                    return d?.reason ? (
                      <div className="notif-page-item-reason">
                        {t('notifications.reason')} {d.reason}
                      </div>
                    ) : null;
                  } catch { return null; }
                })()}
                <div className="notif-page-item-time">{relativeTime(n.timestamp)}</div>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  className="notif-page-item-markread"
                  title={t('notifications.title')}
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
