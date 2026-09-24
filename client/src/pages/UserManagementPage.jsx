import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/userService';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/common/ConfirmModal';
import useFormValidation from '../hooks/useFormValidation';
import { FieldError, RequiredMark } from '../components/common/FormValidation';
import { emailRule, requiredRule } from '../utils/validation';

const emptyForm = { email: '', full_name: '', role: 'generator', phone: '', organization: '' };

/** Same "never a blank circle" initials fallback used by the sidebar's own avatar. */
function initialsFor(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function UserRowAvatar({ user }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className="user-row-avatar-img" />;
  }
  return (
    <div className="user-row-avatar-fallback" aria-hidden="true">
      {initialsFor(user.full_name)}
    </div>
  );
}

/** Large avatar shown inside the View modal */
function ModalAvatar({ user, size = 64 }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--brand-primary)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initialsFor(user.full_name)}
    </div>
  );
}

/* View Modal */
function ViewUserModal({ user, onClose }) {
  const { t } = useTranslation('layout');
  if (!user) return null;

  const ROLE_LABELS = {
    super_admin:  t('userManagement.roleLabels.superAdmin'),
    system_admin: t('userManagement.roleLabels.systemAdmin'),
    generator:    t('userManagement.roleLabels.generator'),
    approver:     t('userManagement.roleLabels.approver'),
    recipient:    t('userManagement.roleLabels.recipient'),
  };

  const rows = [
    { label: t('userManagement.viewModal.labelEmail'),       value: user.email },
    { label: t('userManagement.viewModal.labelRole'),        value: ROLE_LABELS[user.role] || user.role },
    { label: t('userManagement.viewModal.labelStatus'),      value: user.is_active ? t('userManagement.active') : t('userManagement.inactive') },
    { label: t('userManagement.viewModal.labelPhone'),       value: user.phone    || '—' },
    { label: t('userManagement.viewModal.labelOrg'),         value: user.organization || '—' },
    { label: t('userManagement.viewModal.labelMemberSince'), value: user.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '—' },
  ];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true"
      aria-label={t('userManagement.viewModal.title', { name: user.full_name })}
      onClick={onClose}
    >
      <div className="modal-panel" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <ModalAvatar user={user} size={44} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{user.full_name}</h2>
              <span className={`role-pill role-pill-${user.role}`} style={{ marginTop: 4, display: 'inline-block' }}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </div>
          <button type="button" className="modal-close-btn"
            aria-label={t('userManagement.viewModal.closeAriaLabel')} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '20px 20px 4px' }}>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 20px' }}>
            {rows.map(({ label, value }) => (
              <>
                <dt key={`dt-${label}`} style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', paddingTop: 2 }}>
                  {label}
                </dt>
                <dd key={`dd-${label}`} style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9rem', wordBreak: 'break-word' }}>
                  {label === t('userManagement.viewModal.labelStatus') ? (
                    <span className={`status-badge ${user.is_active ? 'status-active' : 'status-archived'}`}>{value}</span>
                  ) : value}
                </dd>
              </>
            ))}
          </dl>
        </div>

        <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('userManagement.viewModal.closeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Edit Modal */
function EditUserModal({ user, onClose, onSaved }) {
  const { t } = useTranslation('layout');
  const { showToast } = useToast();

  const ROLE_OPTIONS = [
    { value: 'system_admin', label: t('userManagement.roleOptions.systemAdmin') },
    { value: 'generator',    label: t('userManagement.roleOptions.generator') },
    { value: 'approver',     label: t('userManagement.roleOptions.approver') },
  ];

  const [form, setForm] = useState({
    full_name: user.full_name || '',
    role:      user.role      || 'generator',
    phone:     user.phone     || '',
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setLocalError(t('userManagement.editModal.fullNameRequired')); return; }
    setSaving(true);
    try {
      await userService.update(user.id, {
        full_name: form.full_name.trim(),
        role:      form.role,
        phone:     form.phone.trim() || null,
      });
      showToast(t('userManagement.editModal.successMsg'), 'success');
      onSaved({ ...user, ...form, full_name: form.full_name.trim(), phone: form.phone.trim() || null });
      onClose();
    } catch (err) {
      showToast(err.message || t('userManagement.editModal.failedMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true"
      aria-label={`${t('userManagement.editModal.title')}: ${user.full_name}`}
      onClick={onClose}
    >
      <div className="modal-panel" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <ModalAvatar user={user} size={40} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{t('userManagement.editModal.title')}</h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn"
            aria-label={t('userManagement.viewModal.closeAriaLabel')}
            onClick={onClose} disabled={saving}>✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ padding: '20px' }}>
          <div className="form-field">
            <label htmlFor="edit-full-name">
              {t('userManagement.editModal.fullNameLabel')} <RequiredMark />
            </label>
            <input
              id="edit-full-name"
              value={form.full_name}
              onChange={handleChange('full_name')}
              placeholder="Bimels Habtamu"
            />
          </div>

          <div className="form-field">
            <label htmlFor="edit-role">
              {t('userManagement.editModal.roleLabel')} <RequiredMark />
            </label>
            <select id="edit-role" value={form.role} onChange={handleChange('role')}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="edit-phone">
              {t('userManagement.editModal.phoneLabel')} <span className="field-optional">({t('common.optional', { ns: 'translation' })})</span>
            </label>
            <input
              id="edit-phone"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="+251 9** *** ***"
            />
          </div>

          {localError && (
            <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--danger)' }}>{localError}</p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              {t('userManagement.editModal.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('userManagement.editModal.update') : t('userManagement.editModal.updateChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Main Page */
export default function UserManagementPage() {
  const { t } = useTranslation('layout');
  const { showToast } = useToast();
  const { errors, runValidation, clearFieldError, fieldProps } = useFormValidation();

  const ROLE_OPTIONS = [
    { value: 'system_admin', label: t('userManagement.roleOptions.systemAdmin') },
    { value: 'generator',    label: t('userManagement.roleOptions.generator') },
    { value: 'approver',     label: t('userManagement.roleOptions.approver') },
  ];

  const ROLE_LABELS = {
    super_admin:  t('userManagement.roleLabels.superAdmin'),
    system_admin: t('userManagement.roleLabels.systemAdmin'),
    generator:    t('userManagement.roleLabels.generator'),
    approver:     t('userManagement.roleLabels.approver'),
    recipient:    t('userManagement.roleLabels.recipient'),
  };

  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId]         = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [viewingUser, setViewingUser]     = useState(null);
  const [editingUser, setEditingUser]     = useState(null);
  const [search, setSearch]         = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await userService.getAll();
      setUsers(res.data);
    } catch (err) {
      showToast(err.message || t('userManagement.toasts.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    clearFieldError(field);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const isValid = runValidation({
      email:        (v) => emailRule(v, { requiredMsg: 'Please enter the email address.' }),
      full_name:    (v) => requiredRule(v, 'The full name'),
      organization: (v) => requiredRule(v, 'The organization / company / institution'),
    }, form);
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await userService.create(form);
      showToast(res.message || t('userManagement.toasts.created'), 'success');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      showToast(err.message || t('userManagement.toasts.createFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    setBusyId(user.id);
    try {
      const res = await userService.updateStatus(user.id, !user.is_active);
      showToast(res.message || t('userManagement.toasts.updated'), 'success');
      load();
    } catch (err) {
      showToast(err.message || t('userManagement.toasts.updateStatusFailed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (user) => setPendingDelete(user);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const user = pendingDelete;
    setBusyId(user.id);
    try {
      const res = await userService.remove(user.id);
      showToast(res.message || t('userManagement.toasts.deleted'), 'success');
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      showToast(err.message || t('userManagement.toasts.deleteFailed'), 'error');
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  };

  const handleUserSaved = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div className="user-management-page">
      <div className="page-header user-management-header">
        <div>
          <h1>{t('userManagement.title')}</h1>
          <p className="user-management-subtitle">
            {loading
              ? t('userManagement.subtitleLoading')
              : users.length === 1
                ? t('userManagement.subtitle', { total: users.length, active: activeCount })
                : t('userManagement.subtitlePlural', { total: users.length, active: activeCount })}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t('userManagement.cancel') : t('userManagement.createUser')}
        </button>
      </div>

      {showForm && (
        <form className="template-form" onSubmit={handleCreate} noValidate style={{ maxWidth: 480, marginBottom: 24 }}>
          <div className="form-field">
            <label htmlFor="new-email">{t('userManagement.form.emailLabel')} <RequiredMark /></label>
            <input
              id="new-email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder={t('userManagement.form.emailPlaceholder')}
              {...fieldProps('email', { errorId: 'new-email-error' })}
            />
            <FieldError id="new-email-error" message={errors.email} />
          </div>
          <div className="form-field">
            <label htmlFor="new-name">{t('userManagement.form.fullNameLabel')} <RequiredMark /></label>
            <input
              id="new-name"
              value={form.full_name}
              onChange={handleChange('full_name')}
              placeholder={t('userManagement.form.fullNamePlaceholder')}
              {...fieldProps('full_name', { errorId: 'new-name-error' })}
            />
            <FieldError id="new-name-error" message={errors.full_name} />
          </div>
          <div className="form-field">
            <label htmlFor="new-organization">{t('userManagement.form.orgLabel')} <RequiredMark /></label>
            <input
              id="new-organization"
              value={form.organization}
              onChange={handleChange('organization')}
              placeholder={t('userManagement.form.orgPlaceholder')}
              {...fieldProps('organization', { errorId: 'new-organization-error' })}
            />
            <FieldError id="new-organization-error" message={errors.organization} />
          </div>
          <div className="form-field">
            <label htmlFor="new-role">{t('userManagement.form.roleLabel')} <RequiredMark /></label>
            <select id="new-role" value={form.role} onChange={handleChange('role')}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <FieldError id="new-role-error" message={errors.role} />
          </div>
          <div className="form-field">
            <label htmlFor="new-phone">
              {t('userManagement.form.phoneLabel')} <span className="field-optional">({t('common.optional', { ns: 'translation' })})</span>
            </label>
            <input id="new-phone" value={form.phone} onChange={handleChange('phone')} placeholder={t('userManagement.form.phonePlaceholder')} />
            <FieldError id="new-phone-error" message={errors.phone} />
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
            {t('userManagement.form.welcomeEmailNote')}
          </p>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? t('userManagement.form.creating') : t('userManagement.form.createBtn')}
          </button>
        </form>
      )}

      <div className="user-management-card">
        <div className="user-management-toolbar">
          <div className="user-management-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="M21 21L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder={t('userManagement.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('userManagement.searchAriaLabel')}
            />
          </div>
        </div>

        {loading ? (
          <div className="template-list-loading">{t('userManagement.loadingUsers')}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="template-list-empty">
            {search ? t('userManagement.noUsersSearch') : t('userManagement.noUsersEmpty')}
          </div>
        ) : (
          <table className="template-list-table user-management-table">
            <thead>
              <tr>
                <th>{t('userManagement.colUser')}</th>
                <th>{t('userManagement.colRole')}</th>
                <th>{t('userManagement.colStatus')}</th>
                <th>{t('userManagement.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-row-identity">
                      <UserRowAvatar user={u} />
                      <div className="user-row-identity-text">
                        <div className="user-row-name">{u.full_name}</div>
                        <div className="user-row-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-pill role-pill-${u.role}`}>
                      {ROLE_LABELS[u.role] || u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${u.is_active ? 'status-active' : 'status-archived'}`}>
                      {u.is_active ? t('userManagement.statusActive') : t('userManagement.statusInactive')}
                    </span>
                  </td>
                  <td className="template-actions">
                    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setViewingUser(u)}
                        title={t('userManagement.viewBtn')}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {t('userManagement.viewBtn')}
                      </button>

                      {u.role !== 'super_admin' && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingUser(u)}
                            disabled={busyId === u.id}
                            title={t('userManagement.editBtn')}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {t('userManagement.editBtn')}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={busyId === u.id}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {u.is_active ? t('userManagement.deactivate') : t('userManagement.activate')}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={busyId === u.id}
                            className="btn-danger"
                            title={t('userManagement.deleteBtn')}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {busyId === u.id ? t('userManagement.working') : t('userManagement.deleteBtn')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewingUser && (
        <ViewUserModal user={viewingUser} onClose={() => setViewingUser(null)} />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleUserSaved}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title={t('userManagement.deleteModal.title')}
          message={<>{t('userManagement.deleteModal.message', { name: pendingDelete.full_name, email: pendingDelete.email })}</>}
          confirmLabel={t('userManagement.deleteModal.confirmLabel')}
          busy={busyId === pendingDelete.id}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
