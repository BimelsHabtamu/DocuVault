import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function StatusBadge({ downloaded }) {
  if (downloaded) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold
        bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"/>
        Downloaded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold
      bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"/>
      Delivered
    </span>
  );
}

function CategoryBadge({ category }) {
  const colors = {
    HR:          'bg-violet-100 text-violet-700',
    Finance:     'bg-amber-100 text-amber-700',
    Academic:    'bg-sky-100 text-sky-700',
    Procurement: 'bg-orange-100 text-orange-700',
    General:     'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[category] || colors.General}`}>
      {category}
    </span>
  );
}

export default function RecipientInboxPage() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const highlightId  = params.get('highlight') || '';

  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');

  const highlightRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    axiosInstance.get('/recipient/documents')
      .then(r => setDocs(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load your documents. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll to highlighted card after docs load
  useEffect(() => {
    if (!loading && highlightId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [loading, highlightId]);

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    return (
      (d.doc_uuid || '').toLowerCase().includes(q) ||
      (d.template_name || '').toLowerCase().includes(q) ||
      (d.record_identifier || '').toLowerCase().includes(q)
    );
  });

  const total      = docs.length;
  const downloaded = docs.filter(d => d.downloaded_at).length;
  const pending    = total - downloaded;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">My Documents</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          All documents delivered to your account
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Delivered', value: total,      color: 'border-indigo-400', text: 'text-[#3b5bdb]' },
          { label: 'Downloaded',      value: downloaded, color: 'border-emerald-400', text: 'text-emerald-600' },
          { label: 'Not Yet Viewed',  value: pending,    color: 'border-amber-400',   text: 'text-amber-600' },
        ].map(s => (
          <div key={s.label}
            className={`bg-[var(--color-surface)] rounded-xl border-l-4 ${s.color}
              shadow-sm p-4`}>
            <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              {s.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${s.text}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4
          text-[var(--color-text-secondary)] pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by document ID, template name…"
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-[var(--color-border)]
            rounded-xl bg-[var(--color-bg)] text-[var(--color-text-primary)]
            placeholder-[var(--color-text-secondary)]
            focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
        />
      </div>

      {/* Document grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
              shadow-sm p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-[var(--color-border)] rounded w-3/4"/>
              <div className="h-3 bg-[var(--color-border)] rounded w-1/2"/>
              <div className="h-3 bg-[var(--color-border)] rounded w-2/3"/>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Something went wrong</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xs">{error}</p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold
              px-4 py-2 rounded-lg bg-[#3b5bdb] text-white hover:bg-[#2f4ac4] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-[var(--color-surface)] border border-[var(--color-border)]
            rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {search ? 'No documents match your search' : 'No documents delivered yet'}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {search ? 'Try a different search term' : 'Documents will appear here when delivered to you'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const isHighlighted = doc.doc_uuid === highlightId;
            return (
              <div
                key={doc.doc_uuid}
                ref={isHighlighted ? highlightRef : null}
                className={`bg-[var(--color-surface)] rounded-2xl border shadow-sm p-5 space-y-4
                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer
                  ${isHighlighted
                    ? 'border-[#3b5bdb] ring-2 ring-[#3b5bdb]/20 shadow-indigo-100/60'
                    : 'border-[var(--color-border)] hover:border-indigo-200'
                  }`}
                onClick={() => navigate(`/my-documents/${doc.doc_uuid}`)}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <StatusBadge downloaded={!!doc.downloaded_at} />
                </div>

                {/* Template name */}
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)] leading-snug line-clamp-2">
                    {doc.template_name}
                  </p>
                  {doc.record_identifier && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Record: <span className="font-mono">{doc.record_identifier}</span>
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <CategoryBadge category={doc.template_category} />
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    <span className="font-medium">Doc ID:</span>{' '}
                    <span className="font-mono">{doc.doc_uuid}</span>
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    <span className="font-medium">Delivered:</span> {fmt(doc.delivered_at)}
                  </p>
                  {doc.downloaded_at && (
                    <p className="text-[11px] text-emerald-600">
                      <span className="font-medium">Downloaded:</span> {fmt(doc.downloaded_at)}
                    </p>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/my-documents/${doc.doc_uuid}`); }}
                  className="w-full bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-xs font-bold
                    py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  View & Download
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
