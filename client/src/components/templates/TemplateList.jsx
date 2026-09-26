import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { templateService } from '../../services/templateService';
import { useToast } from '../../hooks/useToast';
import { useOfflineGuard } from '../../hooks/useOfflineGuard';
import ConfirmModal from '../common/ConfirmModal';

/** Small document-style icon, matches the "this is a document" look every template card gets. */
function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h6M9 8.5h2" />
    </svg>
  );
}

export default function TemplateList() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { guardedAction, isOffline } = useOfflineGuard();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // disables buttons on the card being acted on
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name } awaiting confirmation

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await templateService.getAll();
      setTemplates(res.data);
    } catch (err) {
      showToast(err.message || 'Failed to load templates.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (id, name) => {
    if (isOffline) {
      showToast('You are offline. Please reconnect to perform this action.', 'error');
      return;
    }
    setPendingDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    await guardedAction(
      async () => {
        setBusyId(id);
        try {
          await templateService.remove(id);
          showToast('Template deleted successfully.', 'success');
          setTemplates((prev) => prev.filter((t) => t.id !== id));
        } finally {
          setBusyId(null);
          setPendingDelete(null);
        }
      },
      {
        offlineMessage: 'You are offline. Templates cannot be deleted without a server connection.',
        onBlocked: () => setPendingDelete(null),
        onError: (err) => {
          if (!err.isOfflineError) showToast(err.message || 'Failed to delete template.', 'error');
          setBusyId(null);
          setPendingDelete(null);
        },
      }
    );
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'archived' : 'active';
    await guardedAction(
      async () => {
        setBusyId(id);
        try {
          await templateService.updateStatus(id, nextStatus);
          showToast(`Template marked as ${nextStatus}.`, 'success');
          setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
        } finally {
          setBusyId(null);
        }
      },
      {
        offlineMessage: 'You are offline. Template status cannot be changed without a server connection.',
        onError: (err) => {
          if (!err.isOfflineError) showToast(err.message || 'Failed to update status.', 'error');
          setBusyId(null);
        },
      }
    );
  };

  if (loading) return <div className="template-list-loading">Loading templates…</div>;

  if (templates.length === 0) {
    return (
      <div className="template-list-empty">
        <p>No templates yet.</p>
        <Link
          to={isOffline ? '#' : '/templates/create'}
          className="btn-primary"
          onClick={(e) => {
            if (isOffline) {
              e.preventDefault();
              showToast('You are offline. Please reconnect to perform this action.', 'error');
            }
          }}
          aria-disabled={isOffline}
        >
          + Create Template
        </Link>
      </div>
    );
  }

  return (
    <div className="template-card-grid">
      {templates.map((t) => (
        <div className="template-card" key={t.id}>
          <div className="template-card-top">
            <div className="template-card-icon"><DocumentIcon /></div>
            <div className="template-card-title-wrap">
              <h3 className="template-card-name" title={t.name}>{t.name}</h3>
              <span className="template-card-category">{t.category}</span>
            </div>
          </div>

          <div className="template-card-meta">
            <span className="template-card-meta-item"><strong>Version</strong> v{t.version}</span>
            <span className="template-card-meta-item">
              <strong>Status</strong> <span className={`status-badge status-${t.status}`}>{t.status}</span>
            </span>
            <span className="template-card-meta-item"><strong>Updated</strong> {new Date(t.updated_at).toLocaleDateString()}</span>
          </div>

          <div className="template-card-actions">
            <button
              type="button"
              className="tpl-action-btn tpl-action-view"
              onClick={() => navigate(`/templates/view/${t.id}`)}
              disabled={busyId === t.id}
            >
              View
            </button>
            <Link
              to={isOffline ? '#' : `/templates/edit/${t.id}`}
              className={`tpl-action-btn tpl-action-edit${isOffline ? ' tpl-action-btn--offline' : ''}`}
              onClick={(e) => {
                if (isOffline) {
                  e.preventDefault();
                  showToast('You are offline. Please reconnect to perform this action.', 'error');
                }
              }}
              title={isOffline ? 'You are offline' : undefined}
              aria-disabled={isOffline}
            >
              Edit
            </Link>
            <button
              type="button"
              className={`tpl-action-btn ${t.status === 'active' ? 'tpl-action-archive' : 'tpl-action-activate'}`}
              onClick={() => handleToggleStatus(t.id, t.status)}
              disabled={busyId === t.id || isOffline}
              title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}
            >
              {t.status === 'active' ? 'Archive' : 'Activate'}
            </button>
            <button
              type="button"
              className="tpl-action-btn tpl-action-delete"
              onClick={() => handleDelete(t.id, t.name)}
              disabled={busyId === t.id || isOffline}
              title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {pendingDelete && (
        <ConfirmModal
          title="Delete template?"
          itemName={pendingDelete.name}
          confirmLabel="Delete"
          busy={busyId === pendingDelete.id}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
