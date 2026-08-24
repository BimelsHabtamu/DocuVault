import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance   from '../api/axiosInstance';
import { useToast }    from '../context/ToastContext';
import ConfirmDialog   from '../components/ui/ConfirmDialog';
import { SkeletonTableRow } from '../components/ui/Skeleton';

const CAT_COLORS = {
  HR:          'bg-blue-100   text-blue-700',
  Finance:     'bg-green-100  text-green-700',
  Academic:    'bg-purple-100 text-purple-700',
  Procurement: 'bg-orange-100 text-orange-700',
  General:     'bg-gray-100   text-gray-600',
};
const WM_COLORS = {
  DRAFT:        'bg-yellow-100 text-yellow-700',
  CONFIDENTIAL: 'bg-red-100    text-red-600',
  FINAL:        'bg-green-100  text-green-700',
};
const CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];
const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function CategoryBadge({ c }) {
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${CAT_COLORS[c] || 'bg-gray-100 text-gray-500'}`}>
      {c}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full
      ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-[var(--color-text-secondary)]'}`}/>
      {active ? 'Active' : 'Archived'}
    </span>
  );
}

function WatermarkBadge({ text }) {
  if (!text) return <span className="text-xs text-[var(--color-text-secondary)]">—</span>;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${WM_COLORS[text] || 'bg-gray-100 text-gray-500'}`}>
      {text}
    </span>
  );
}

export default function TemplatesPage() {
  const navigate   = useNavigate();
  const toast      = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [catFilter, setCat]       = useState('All');
  const [statusFilter, setStatus] = useState('all');
  const [deleteTarget, setDelete] = useState(null);

  const load = () => {
    setLoading(true);
    axiosInstance.get('/templates')
      .then(r => setTemplates(r.data))
      .catch(() => toast.error('Could not load templates'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => templates.filter(t => {
    const ms  = t.name.toLowerCase().includes(search.toLowerCase()) ||
                (t.description || '').toLowerCase().includes(search.toLowerCase());
    const mc  = catFilter === 'All' || t.category === catFilter;
    const mst = statusFilter === 'all'
      ? true
      : statusFilter === 'active' ? t.is_active : !t.is_active;
    return ms && mc && mst;
  }), [templates, search, catFilter, statusFilter]);

  const counts = useMemo(() => ({
    total:    templates.length,
    active:   templates.filter(t => t.is_active).length,
    archived: templates.filter(t => !t.is_active).length,
  }), [templates]);

  const toggleStatus = async (t) => {
    try {
      await axiosInstance.patch(`/templates/${t.id}/status`, { is_active: t.is_active ? 0 : 1 });
      toast.success(t.is_active ? 'Template archived' : 'Template activated');
      load();
    } catch { toast.error('Update failed'); }
  };

  const handleDelete = async () => {
    try {
      await axiosInstance.delete(`/templates/${deleteTarget.id}`);
      toast.success('Template deleted');
      setDelete(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
      setDelete(null);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Templates</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {counts.total} total ·{' '}
            <span className="text-emerald-600 font-medium">{counts.active} active</span> ·{' '}
            <span className="text-[var(--color-text-secondary)]">{counts.archived} archived</span>
          </p>
        </div>
        <button
          onClick={() => navigate('/templates/new')}
          className="inline-flex items-center gap-2 bg-[#3b5bdb] hover:bg-[#2f4ac4]
            text-white text-sm font-semibold px-4 py-2.5 rounded-xl
            transition-colors shadow-sm shadow-indigo-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          New Template
        </button>
      </div>

      {/* ── KPI strip ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: counts.total,    border: 'border-[#3b5bdb]',    color: 'text-[#3b5bdb]' },
          { label: 'Active',   value: counts.active,   border: 'border-emerald-500', color: 'text-emerald-600' },
          { label: 'Archived', value: counts.archived, border: 'border-gray-400',    color: 'text-[var(--color-text-secondary)]' },
        ].map(c => (
          <div key={c.label}
            className={`bg-[var(--color-surface)] rounded-2xl border-l-4 ${c.border} shadow-sm p-4`}>
            <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              {c.label}
            </p>
            <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
        shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
            text-[var(--color-text-secondary)] pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-4 py-2 border border-[var(--color-border)] rounded-xl text-sm
              bg-[var(--color-bg)] text-[var(--color-text-primary)]
              placeholder-[var(--color-text-secondary)]
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
                ${catFilter === c
                  ? 'bg-[#3b5bdb] text-white'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}>
              {c}
            </button>
          ))}
        </div>
        <select
          value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm
            bg-[var(--color-surface)] text-[var(--color-text-primary)]
            focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
        shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                {['Template', 'Category', 'Version', 'Data Source', 'Watermark', 'Status', 'Updated', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold
                    text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading && [1, 2, 3, 4, 5].map(i => <SkeletonTableRow key={i} cols={8}/>)}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-raised)]
                        border border-[var(--color-border)] flex items-center justify-center">
                        <svg className="w-6 h-6 text-[var(--color-text-secondary)]" fill="none"
                          stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {search || catFilter !== 'All' || statusFilter !== 'all'
                          ? 'No templates match your filters'
                          : 'No templates yet'
                        }
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {search || catFilter !== 'All' || statusFilter !== 'all'
                          ? 'Try clearing your search or filters'
                          : 'Create your first template to get started'
                        }
                      </p>
                      {!search && catFilter === 'All' && statusFilter === 'all' && (
                        <button
                          onClick={() => navigate('/templates/new')}
                          className="mt-1 text-xs font-semibold text-[#3b5bdb]
                            bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
                        >
                          Create your first template →
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.map(t => (
                <tr key={t.id} className="hover:bg-[var(--color-surface-raised)] transition-colors group">

                  {/* Template name + logo + description */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-raised)]
                        border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {t.logo_path
                          ? <img
                              src={`${API_BASE}/${t.logo_path}`}
                              alt="logo"
                              className="w-9 h-9 rounded-xl object-contain"
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          : <svg className="w-4 h-4 text-[var(--color-text-secondary)]"
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--color-text-primary)] text-sm">{t.name}</p>
                        {t.description && (
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 max-w-[200px] truncate">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-5 py-4"><CategoryBadge c={t.category}/></td>

                  {/* Version */}
                  <td className="px-5 py-4">
                    <span className="text-xs font-bold bg-[var(--color-surface-raised)]
                      text-[var(--color-text-secondary)] border border-[var(--color-border)]
                      px-2 py-1 rounded-lg">
                      v{t.version}
                    </span>
                  </td>

                  {/* Data Source */}
                  <td className="px-5 py-4">
                    {t.data_source
                      ? <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold
                          bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7M4 7c0-2 1.5-3 3.5-3h9C18.5 4 20 5 20 7M4 7h16"/>
                          </svg>
                          {t.data_source}
                        </span>
                      : <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                    }
                  </td>

                  {/* Watermark */}
                  <td className="px-5 py-4"><WatermarkBadge text={t.watermark_text}/></td>

                  {/* Status */}
                  <td className="px-5 py-4"><StatusBadge active={t.is_active}/></td>

                  {/* Updated */}
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                    {new Date(t.updated_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

                      {/* Edit */}
                      <button onClick={() => navigate(`/templates/${t.id}/edit`)} title="Edit"
                        className="w-8 h-8 rounded-lg flex items-center justify-center
                          text-[var(--color-text-secondary)]
                          hover:bg-indigo-50 hover:text-[#3b5bdb] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>

                      {/* Archive / Activate */}
                      <button onClick={() => toggleStatus(t)}
                        title={t.is_active ? 'Archive' : 'Activate'}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center
                          text-[var(--color-text-secondary)] transition-colors
                          ${t.is_active
                            ? 'hover:bg-yellow-50 hover:text-yellow-600'
                            : 'hover:bg-emerald-50 hover:text-emerald-600'
                          }`}>
                        {t.is_active
                          ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                            </svg>
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                            </svg>
                        }
                      </button>

                      {/* Delete */}
                      <button onClick={() => setDelete(t)} title="Delete"
                        className="w-8 h-8 rounded-lg flex items-center justify-center
                          text-[var(--color-text-secondary)]
                          hover:bg-red-50 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border)]
          flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Showing {filtered.length} of {templates.length} templates
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
            <p className="text-xs text-emerald-600 font-medium">Live from database</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDelete(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone. Any generated documents linked to this template will lose their template reference.`}
        confirmLabel="Delete Template"
      />
    </div>
  );
}
