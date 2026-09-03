import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useToast } from '../context/ToastContext';
import { useAuth }  from '../context/AuthContext';

const STATUS_META = {
  draft:          { bg:'bg-gray-100',    text:'text-gray-600',    dot:'bg-gray-400',    label:'Draft'          },
  pending:        { bg:'bg-yellow-100',  text:'text-yellow-700',  dot:'bg-yellow-400',  label:'Pending'        },
  signed:         { bg:'bg-blue-100',    text:'text-blue-700',    dot:'bg-blue-500',    label:'Signed'         },
  delivered:      { bg:'bg-emerald-100', text:'text-emerald-700', dot:'bg-emerald-500', label:'Delivered'      },
  rejected:       { bg:'bg-red-100',     text:'text-red-600',     dot:'bg-red-400',     label:'Rejected'       },
  hand_delivered: { bg:'bg-purple-100',  text:'text-purple-700',  dot:'bg-purple-500',  label:'Hand Delivered' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`}/>
      {m.label}
    </span>
  );
}

function fmt(d) {
  return d ? new Date(d).toLocaleString('en-US', {
    month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'
  }) : '—';
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const toast    = useToast();

  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [approvers, setApprovers] = useState([]);
  const [working, setWorking]     = useState(false);

  // Modals
  const [signModal,    setSignModal]    = useState(null); // doc id
  const [deliverModal, setDeliverModal] = useState(null); // doc id
  const [detailDoc,    setDetail]       = useState(null); // doc object

  const [selectedApprover, setApprover]    = useState('');
  const [recipientEmail,   setEmail]       = useState('');
  const [recipientName,    setRecipName]   = useState('');
  const [handModal,        setHandModal]   = useState(null); // doc id for hand-deliver confirm

  const load = () => {
    setLoading(true);
    axiosInstance.get('/documents').then(r => setDocs(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    axiosInstance.get('/users/approvers')
      .then(r => setApprovers(r.data))
      .catch(() => {});
  }, []);

  const isAdmin    = user?.role === 'super_admin' || user?.role === 'system_admin';
  const canSign    = isAdmin || user?.role === 'generator'; // only these roles can POST /esign/request
  const canDeliver = isAdmin || user?.role === 'generator';

  const counts = useMemo(() => ({
    total:          docs.length,
    draft:          docs.filter(d => d.status === 'draft').length,
    pending:        docs.filter(d => d.status === 'pending').length,
    signed:         docs.filter(d => d.status === 'signed').length,
    delivered:      docs.filter(d => d.status === 'delivered').length,
    rejected:       docs.filter(d => d.status === 'rejected').length,
    hand_delivered: docs.filter(d => d.status === 'hand_delivered').length,
  }), [docs]);

  const filtered = useMemo(() => docs.filter(d => {
    const q  = search.toLowerCase();
    const ms = d.doc_uuid.toLowerCase().includes(q) ||
               (d.template_name || '').toLowerCase().includes(q) ||
               (d.record_identifier || '').toLowerCase().includes(q);
    const mf = statusFilter === 'all' || d.status === statusFilter;
    return ms && mf;
  }), [docs, search, statusFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const requestSign = async () => {
    if (!selectedApprover) return;
    setWorking(true);
    try {
      await axiosInstance.post('/esign/request', {
        doc_id: signModal, approver_id: Number(selectedApprover),
      });
      toast.success('Signature request sent to approver');
      setSignModal(null); setApprover('');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Request failed'); }
    finally { setWorking(false); }
  };

  const deliver = async () => {
    if (!recipientEmail) return;
    setWorking(true);
    try {
      await axiosInstance.post('/delivery/deliver', {
        doc_id: deliverModal, recipient_email: recipientEmail, recipient_name: recipientName,
      });
      toast.success('Document delivered successfully');
      setDeliverModal(null); setEmail(''); setRecipName('');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Delivery failed'); }
    finally { setWorking(false); }
  };

  const markHandDelivered = async () => {
    setWorking(true);
    try {
      await axiosInstance.patch(`/documents/${handModal}/hand-delivered`);
      toast.success('Document marked as Hand Delivered');
      setHandModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to update status'); }
    finally { setWorking(false); }
  };

  const downloadDoc = async (doc) => {
    try {
      const res = await axiosInstance.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url; a.download = `${doc.doc_uuid}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Documents</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          All generated PDF documents — live from database
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
        {[
          { l:'Total',         v:counts.total,          filter:'all',           b:'border-gray-400',   c:'text-gray-700' },
          { l:'Draft',         v:counts.draft,          filter:'draft',         b:'border-gray-400',   c:'text-gray-600' },
          { l:'Pending',       v:counts.pending,        filter:'pending',       b:'border-yellow-400', c:'text-yellow-700' },
          { l:'Signed',        v:counts.signed,         filter:'signed',        b:'border-blue-500',   c:'text-blue-700' },
          { l:'Delivered',     v:counts.delivered,      filter:'delivered',     b:'border-emerald-500',c:'text-emerald-700' },
          { l:'Hand Del.',     v:counts.hand_delivered, filter:'hand_delivered',b:'border-purple-500', c:'text-purple-700' },
          { l:'Rejected',      v:counts.rejected,       filter:'rejected',      b:'border-red-400',    c:'text-red-600' },
        ].map(s => (
          <button key={s.l} onClick={() => setStatus(s.filter)}
            className={`bg-[var(--color-surface)] rounded-xl border-l-4 ${s.b} shadow-sm p-3 text-left
              hover:shadow-md transition-shadow
              ${statusFilter === s.filter ? 'ring-2 ring-[#3b5bdb]/30' : ''}`}>
            <p className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold tracking-wide">{s.l}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.c}`}>{s.v}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search doc ID, template, record..."
            className="w-full pl-9 pr-4 py-2 border border-[var(--color-border)] rounded-xl text-sm
              bg-[var(--color-bg)] text-[var(--color-text-primary)]
              placeholder-[var(--color-text-secondary)]
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all','draft','pending','signed','delivered','hand_delivered','rejected'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors
                ${statusFilter === s
                  ? 'bg-[var(--color-text-primary)] text-[var(--color-surface)]'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}>
              {s === 'all' ? 'All' : s === 'hand_delivered' ? 'Hand Del.' : s}
            </button>
          ))}
        </div>
        <Link to="/generate"
          className="flex items-center gap-1.5 bg-[#3b5bdb] hover:bg-[#2f4ac4]
            text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors ml-auto">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Generate New
        </Link>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                {['Document ID','Template','Record ID','Status','Generated By','Date','Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold
                    text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading && (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <svg className="animate-spin w-5 h-5 text-[#3b5bdb] mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-14 text-center">
                  <svg className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <p className="text-sm text-[var(--color-text-secondary)]">No documents found</p>
                  <Link to="/generate" className="inline-block mt-3 text-xs font-semibold text-[#3b5bdb]
                    hover:text-[#2f4ac4] bg-indigo-50 px-4 py-2 rounded-lg">
                    Generate your first document →
                  </Link>
                </td></tr>
              )}
              {!loading && filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-[var(--color-surface-raised)] transition-colors group">
                  <td className="px-5 py-4">
                    <button onClick={() => setDetail(doc)}
                      className="font-mono text-xs bg-[var(--color-surface-raised)]
                        hover:bg-indigo-50 hover:text-[#3b5bdb]
                        text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg transition-colors">
                      {doc.doc_uuid}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-[var(--color-text-primary)]">
                    {doc.template_name}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono">
                    {doc.record_identifier || '—'}
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={doc.status}/></td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)]">
                    {doc.generated_by_name}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                    {fmt(doc.generated_at)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Download */}
                      <button onClick={() => downloadDoc(doc)} title="Download PDF"
                        className="w-8 h-8 rounded-lg flex items-center justify-center
                          text-[var(--color-text-secondary)] hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                      </button>
                      {/* Request signature */}
                      {canSign && doc.status === 'draft' && (
                        <button onClick={() => { setSignModal(doc.id); setApprover(''); }}
                          title="Request Signature"
                          className="w-8 h-8 rounded-lg flex items-center justify-center
                            text-[var(--color-text-secondary)] hover:bg-blue-50 hover:text-blue-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                          </svg>
                        </button>
                      )}
                      {/* Deliver */}
                      {canDeliver && doc.status === 'signed' && (
                        <button onClick={() => { setDeliverModal(doc.id); setEmail(''); setRecipName(''); }}
                          title="Deliver to recipient"
                          className="w-8 h-8 rounded-lg flex items-center justify-center
                            text-[var(--color-text-secondary)] hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                          </svg>
                        </button>
                      )}
                      {/* Hand Delivered — admin only, signed or delivered */}
                      {isAdmin && (doc.status === 'signed' || doc.status === 'delivered') && (
                        <button onClick={() => setHandModal(doc.id)}
                          title="Mark as Hand Delivered"
                          className="w-8 h-8 rounded-lg flex items-center justify-center
                            text-[var(--color-text-secondary)] hover:bg-purple-50 hover:text-purple-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                              d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/>
                          </svg>
                        </button>
                      )}
                      {/* Verify */}
                      <a href={`/verify?id=${doc.doc_uuid}`} title="Verify document"
                        className="w-8 h-8 rounded-lg flex items-center justify-center
                          text-[var(--color-text-secondary)] hover:bg-yellow-50 hover:text-yellow-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Showing {filtered.length} of {docs.length} documents
          </p>
          <p className="text-xs text-emerald-600 font-medium">● Live from database</p>
        </div>
      </div>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      {detailDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}/>
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-text-primary)]">Document Details</h3>
              <button onClick={() => setDetail(null)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="space-y-0">
              {[
                { l:'Document ID',  v:<span className="font-mono text-xs">{detailDoc.doc_uuid}</span> },
                { l:'Template',     v:detailDoc.template_name },
                { l:'Record ID',    v:detailDoc.record_identifier || '—' },
                { l:'Status',       v:<StatusBadge status={detailDoc.status}/> },
                { l:'Generated By', v:detailDoc.generated_by_name },
                { l:'Generated At', v:fmt(detailDoc.generated_at) },
                { l:'SHA-256 Hash', v:<span className="font-mono text-[10px] text-[var(--color-text-secondary)] break-all">{detailDoc.file_hash || '—'}</span> },
              ].map(r => (
                <div key={r.l} className="flex justify-between items-start gap-4 py-2.5
                  border-b border-[var(--color-border)] last:border-0">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]
                    uppercase tracking-wide flex-shrink-0 w-28">{r.l}</span>
                  <div className="text-sm text-[var(--color-text-primary)] text-right">{r.v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              {canSign && detailDoc.status === 'draft' && (
                <button onClick={() => { setDetail(null); setSignModal(detailDoc.id); setApprover(''); }}
                  className="flex-1 bg-[#3b5bdb] text-white text-sm font-semibold
                    py-2.5 rounded-xl hover:bg-[#2f4ac4] transition-colors">
                  Request Signature
                </button>
              )}
              {canDeliver && detailDoc.status === 'signed' && (
                <button onClick={() => { setDetail(null); setDeliverModal(detailDoc.id); setEmail(''); setRecipName(''); }}
                  className="flex-1 bg-indigo-600 text-white text-sm font-semibold
                    py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">
                  Deliver
                </button>
              )}
              <button onClick={() => setDetail(null)}
                className="flex-1 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]
                  text-sm font-medium py-2.5 rounded-xl
                  hover:text-[var(--color-text-primary)] transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request Signature Modal ────────────────────────────────────────── */}
      {signModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSignModal(null)}/>
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in">
            <h3 className="font-bold text-[var(--color-text-primary)]">Request E-Signature</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              An email will be sent to the selected approver with a review link and OTP.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)]
                uppercase tracking-wide mb-1.5">Select Approver</label>
              <select value={selectedApprover} onChange={e => setApprover(e.target.value)}
                className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm
                  bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">— Choose approver —</option>
                {approvers.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.role.replace(/_/g,' ')})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={requestSign} disabled={!selectedApprover || working}
                className="flex-1 bg-[#3b5bdb] text-white text-sm font-semibold
                  py-2.5 rounded-xl hover:bg-[#2f4ac4] disabled:opacity-50 transition-colors">
                {working ? 'Sending…' : 'Send Request'}
              </button>
              <button onClick={() => setSignModal(null)}
                className="flex-1 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]
                  text-sm py-2.5 rounded-xl hover:text-[var(--color-text-primary)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deliver Modal ──────────────────────────────────────────────────── */}
      {deliverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setDeliverModal(null); setEmail(''); setRecipName(''); }}/>
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in">
            <h3 className="font-bold text-[var(--color-text-primary)]">Deliver Document</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              A branded email with the signed PDF and a 7-day secure download link will be sent.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)]
                uppercase tracking-wide mb-1.5">Recipient Name</label>
              <input type="text" value={recipientName} onChange={e => setRecipName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm
                  bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  placeholder-[var(--color-text-secondary)]
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)]
                uppercase tracking-wide mb-1.5">Recipient Email</label>
              <input type="email" value={recipientEmail} onChange={e => setEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm
                  bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  placeholder-[var(--color-text-secondary)]
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20"/>
            </div>
            <div className="flex gap-2">
              <button onClick={deliver} disabled={!recipientEmail || working}
                className="flex-1 bg-indigo-600 text-white text-sm font-semibold
                  py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {working ? 'Delivering…' : 'Send & Deliver'}
              </button>
              <button onClick={() => { setDeliverModal(null); setEmail(''); setRecipName(''); }}
                className="flex-1 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]
                  text-sm py-2.5 rounded-xl hover:text-[var(--color-text-primary)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hand Delivered Confirm Modal (FR-031) ──────────────────────────── */}
      {handModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHandModal(null)}/>
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/>
              </svg>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-[var(--color-text-primary)]">Mark as Hand Delivered</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
                Confirm that this document was physically delivered by hand.
                Status will change to <strong>Hand Delivered</strong> and the action will be logged.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={markHandDelivered} disabled={working}
                className="flex-1 bg-purple-600 text-white text-sm font-semibold
                  py-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {working ? 'Updating…' : 'Confirm'}
              </button>
              <button onClick={() => setHandModal(null)}
                className="flex-1 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]
                  text-sm py-2.5 rounded-xl hover:text-[var(--color-text-primary)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
