import { useEffect, useState, useMemo, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';

const CATEGORY_COLORS = {
  HR: 'bg-blue-100 text-blue-700', Finance: 'bg-green-100 text-green-700',
  Academic: 'bg-purple-100 text-purple-700', Procurement: 'bg-orange-100 text-orange-700',
  General: 'bg-gray-100 text-gray-600',
};
const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600', pending: 'bg-yellow-100 text-yellow-700',
  signed: 'bg-blue-100 text-blue-700', delivered: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600', hand_delivered: 'bg-purple-100 text-purple-700',
};
// ── Date placeholders that must be provided by user at generation time ────────
// These are NOT auto-filled by the server like generation_date is.
// The server only auto-fills: generation_date, generation_time,
// generation_datetime, generation_year, generation_month, generation_day
// Everything else that looks like a date placeholder needs user input.
const USER_DATE_PLACEHOLDERS = [
  { key: 'effective_date',   label: 'Effective Date',    hint: 'e.g. contract start, payroll period' },
  { key: 'expiry_date',      label: 'Expiry Date',       hint: 'e.g. contract end date' },
  { key: 'issue_date',       label: 'Issue Date',        hint: 'e.g. certificate issue date' },
  { key: 'start_date',       label: 'Start Date',        hint: '' },
  { key: 'end_date',         label: 'End Date',          hint: '' },
  { key: 'due_date',         label: 'Due Date',          hint: '' },
  { key: 'signing_date',     label: 'Signing Date',      hint: '' },
  { key: 'reference_date',   label: 'Reference Date',    hint: '' },
];

// These are auto-filled by the server — never show input fields for them
const SERVER_AUTO_DATES = new Set([
  'generation_date', 'generation_time', 'generation_datetime',
  'generation_year', 'generation_month', 'generation_day',
]);

/**
 * Scan template HTML for {{date_placeholder}} tokens that need user input.
 * Returns only the ones found in the template that are NOT server-auto-filled.
 */
function detectUserDatePlaceholders(templateHtml) {
  if (!templateHtml) return [];
  const combined = [
    templateHtml.header_html || '',
    templateHtml.body_html   || '',
    templateHtml.footer_html || '',
  ].join(' ');

  const found = [];
  for (const dp of USER_DATE_PLACEHOLDERS) {
    if (combined.includes(`{{${dp.key}}}`)) {
      found.push(dp);
    }
  }
  // Also catch any unknown {{*_date}} or {{*_at}} patterns not in the known list
  const matches = combined.match(/\{\{([a-z_]+(?:_date|_at|_time|_on))\}\}/g) || [];
  for (const m of matches) {
    const key = m.replace(/[{}]/g, '');
    if (!SERVER_AUTO_DATES.has(key) && !found.find(f => f.key === key)) {
      found.push({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), hint: '' });
    }
  }
  return found;
}

function StepBadge({ step, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'text-[#3b5bdb]' : done ? 'text-emerald-500' : 'text-[var(--color-text-secondary)]'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
        ${active ? 'border-[#3b5bdb] bg-[#3b5bdb] text-white'
          : done  ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}>
        {done
          ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
            </svg>
          : step}
      </div>
      <span className={`text-xs font-semibold hidden sm:block
        ${active ? 'text-[#3b5bdb]' : done ? 'text-emerald-600' : 'text-[var(--color-text-secondary)]'}`}>
        {label}
      </span>
    </div>
  );
}

// ── Bulk Job Progress Card ────────────────────────────────────────────────────
function BulkJobCard({ job, onDownload }) {
  const pct     = job.percent || 0;
  const isDone  = job.status === 'done';
  const isError = job.status === 'error';

  return (
    <div className={`bg-[var(--color-surface)] rounded-2xl border shadow-sm p-5 space-y-3
      ${isDone ? 'border-emerald-200' : isError ? 'border-red-200' : 'border-[var(--color-border)]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-[var(--color-text-primary)] truncate">
            {job.jobUuid}
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{job.template}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 capitalize
          ${isDone ? 'bg-emerald-100 text-emerald-700'
            : isError ? 'bg-red-100 text-red-600'
            : job.status === 'processing' ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600'}`}>
          {job.status}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
          <span>{job.completed} / {job.total} completed</span>
          {job.failed > 0 && <span className="text-red-500">{job.failed} failed</span>}
          <span>{pct}%</span>
        </div>
        <div className="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500
            ${isDone ? 'bg-emerald-500' : isError ? 'bg-red-400' : 'bg-[#3b5bdb]'}`}
            style={{ width: `${pct}%` }}/>
        </div>
      </div>

      {isDone && (
        <button onClick={() => onDownload(job.jobUuid)}
          className="w-full flex items-center justify-center gap-2
            bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold
            py-2.5 rounded-xl transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Download All PDFs (.zip)
        </button>
      )}
    </div>
  );
}

export default function GenerateDocPage() {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'bulk'

  // ── Single generation state ───────────────────────────────────────────────
  const [step, setStep]             = useState(1);
  const [templates, setTemplates]   = useState([]);
  const [selectedId, setSelected]   = useState(null);
  const [template, setTemplate]     = useState(null);
  const [values, setValues]         = useState({});
  const [recordId, setRecordId]     = useState('');
  const [preview, setPreview]       = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState(null);
  const [recentDocs, setRecentDocs] = useState([]);
  const [search, setSearch]         = useState('');
  const [error, setError]           = useState('');

  // ── Bulk generation state ─────────────────────────────────────────────────
  const [bulkTemplateId, setBulkTemplate]   = useState('');
  const [bulkRecords, setBulkRecords]       = useState('');   // raw CSV text
  const [bulkParsed, setBulkParsed]         = useState(null); // parsed preview
  const [bulkJobs, setBulkJobs]             = useState([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError]           = useState('');
  const pollRef = useRef({});

  useEffect(() => {
    axiosInstance.get('/templates').then(r => setTemplates(r.data.filter(t => t.is_active)));
    axiosInstance.get('/documents').then(r => setRecentDocs(r.data.slice(0, 8))).catch(() => {});
  }, []);

  const selectTemplate = async (id) => {
    setSelected(id);
    setPreview(''); setError(''); setGenerated(null);
    const res  = await axiosInstance.get(`/templates/${id}`);
    const tmpl = res.data;
    setTemplate(tmpl);
    const init = {};
    (tmpl.placeholders || []).forEach(p => { init[p.field_path] = p.default_value || ''; });
    setValues(init);
  };

  const allFilled = useMemo(() => {
    if (!template?.placeholders?.length) return !!selectedId;
    return template.placeholders.every(p => values[p.field_path]?.trim());
  }, [template, values, selectedId]);

  const doPreview = async () => {
    setPreviewing(true); setError('');
    try {
      const res = await axiosInstance.post('/documents/preview', {
        template_id: Number(selectedId), data: values,
      });
      setPreview(res.data.html);
    } catch (e) { setError(e.response?.data?.message || 'Preview failed'); }
    finally { setPreviewing(false); }
  };

  const doGenerate = async () => {
    setGenerating(true); setError('');
    try {
      const res = await axiosInstance.post('/documents/generate', {
        template_id: Number(selectedId),
        record_identifier: recordId || null,
        data: values,
      });
      setGenerated(res.data);
      setStep(3);
      axiosInstance.get('/documents').then(r => setRecentDocs(r.data.slice(0, 8))).catch(() => {});
    } catch (e) { setError(e.response?.data?.message || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const reset = () => {
    setStep(1); setSelected(null); setTemplate(null);
    setValues({}); setRecordId(''); setPreview(''); setGenerated(null); setError('');
  };

  // ── Bulk: parse CSV ───────────────────────────────────────────────────────
  const parseCsv = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim());
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
      return {
        record_identifier: obj.record_identifier || obj.id || `ROW-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
        data: obj,
      };
    });
    return { headers, rows };
  };

  const handleCsvChange = (text) => {
    setBulkRecords(text);
    setBulkError('');
    if (!text.trim()) { setBulkParsed(null); return; }
    const parsed = parseCsv(text);
    if (!parsed) { setBulkError('CSV must have at least a header row and one data row'); setBulkParsed(null); return; }
    if (parsed.rows.length > 500) { setBulkError('Maximum 500 records per bulk job'); return; }
    setBulkParsed(parsed);
  };

  const handleCsvFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleCsvChange(ev.target.result);
    reader.readAsText(file);
  };

  // ── Bulk: submit job ──────────────────────────────────────────────────────
  const submitBulkJob = async () => {
    if (!bulkTemplateId) { setBulkError('Select a template first'); return; }
    if (!bulkParsed?.rows?.length) { setBulkError('No valid records to process'); return; }
    setBulkSubmitting(true); setBulkError('');
    try {
      const res = await axiosInstance.post('/documents/bulk', {
        template_id: Number(bulkTemplateId),
        records: bulkParsed.rows,
      });
      const jobUuid = res.data.job_uuid;
      const newJob  = { jobUuid, status: 'queued', total: bulkParsed.rows.length, completed: 0, failed: 0, percent: 0, template: templates.find(t => t.id === Number(bulkTemplateId))?.name || '' };
      setBulkJobs(prev => [newJob, ...prev]);
      setBulkRecords(''); setBulkParsed(null);
      // Start polling
      startPolling(jobUuid);
    } catch (e) { setBulkError(e.response?.data?.message || 'Failed to start bulk job'); }
    finally { setBulkSubmitting(false); }
  };

  // ── Bulk: poll progress ───────────────────────────────────────────────────
  const startPolling = (jobUuid) => {
    if (pollRef.current[jobUuid]) return;
    const interval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/documents/bulk/${jobUuid}`);
        const data = res.data;
        setBulkJobs(prev => prev.map(j => j.jobUuid === jobUuid ? { ...j, ...data } : j));
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(pollRef.current[jobUuid]);
          delete pollRef.current[jobUuid];
        }
      } catch {
        clearInterval(pollRef.current[jobUuid]);
        delete pollRef.current[jobUuid];
      }
    }, 2000);
    pollRef.current[jobUuid] = interval;
  };

  // ── Bulk: download zip ────────────────────────────────────────────────────
  const downloadBulkZip = async (jobUuid) => {
    try {
      const res = await axiosInstance.get(`/documents/bulk/${jobUuid}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url; a.download = `${jobUuid}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed — job may not be complete yet'); }
  };

  const filteredDocs = recentDocs.filter(d =>
    d.doc_uuid.toLowerCase().includes(search.toLowerCase()) ||
    (d.template_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Generate Document</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          Single or bulk PDF generation from templates
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[var(--color-surface-raised)] p-1 rounded-xl w-fit border border-[var(--color-border)]">
        {[
          { key: 'single', label: 'Single Document', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { key: 'bulk',   label: 'Bulk Generation', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeTab === tab.key
                ? 'bg-[var(--color-surface)] text-[#3b5bdb] shadow-sm border border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={tab.icon}/>
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          SINGLE GENERATION
      ════════════════════════════════════════════════════ */}
      {activeTab === 'single' && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-4">

          {/* Steps */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm px-6 py-4">
            <div className="flex items-center gap-3">
              <StepBadge step={1} label="Select Template" active={step === 1} done={step > 1}/>
              <div className={`flex-1 h-px ${step > 1 ? 'bg-emerald-300' : 'bg-[var(--color-border)]'}`}/>
              <StepBadge step={2} label="Fill Data" active={step === 2} done={step > 2}/>
              <div className={`flex-1 h-px ${step > 2 ? 'bg-emerald-300' : 'bg-[var(--color-border)]'}`}/>
              <StepBadge step={3} label="Generated" active={step === 3} done={false}/>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}

          {/* Step 1 */}
          <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${step === 1 ? 'border-blue-100' : 'border-gray-100'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${step === 1 ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > 1 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'}`}>
                  {step > 1 ? '✓' : '1'}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Select Template</p>
                  {step > 1 && template && <p className="text-xs text-emerald-600">{template.name} selected</p>}
                </div>
              </div>
              {step > 1 && <button onClick={() => { setStep(1); setPreview(''); }} className="text-xs text-blue-600 font-medium">Change</button>}
            </div>
            {step === 1 && (
              <div className="p-5 space-y-3">
                {templates.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No active templates. Create one first.</p>}
                {templates.map(t => (
                  <button key={t.id} onClick={() => selectTemplate(t.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedId === t.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedId === t.id ? 'bg-blue-600' : 'bg-gray-100'}`}>
                        <svg className={`w-4.5 h-4.5 ${selectedId === t.id ? 'text-white' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold ${selectedId === t.id ? 'text-blue-700' : 'text-gray-800'}`}>{t.name}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-500'}`}>{t.category}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">v{t.version} · {t.watermark_text || 'No watermark'}</p>
                      </div>
                      {selectedId === t.id && <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                    </div>
                  </button>
                ))}
                <button onClick={() => setStep(2)} disabled={!selectedId}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2">
                  Continue to Fill Data →
                </button>
              </div>
            )}
          </div>

          {/* Step 2 */}
          {step >= 2 && (
            <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${step === 2 ? 'border-blue-100' : 'border-gray-100'}`}>
              <div className={`px-6 py-4 border-b flex items-center justify-between ${step === 2 ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > 2 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'}`}>{step > 2 ? '✓' : '2'}</div>
                  <p className="text-sm font-bold text-gray-800">Fill in Data Fields</p>
                </div>
                {template?.placeholders && (
                  <span className="text-xs text-gray-400">
                    {template.placeholders.filter(p => values[p.field_path]?.trim()).length}/{template.placeholders.length} filled
                  </span>
                )}
              </div>
              {step === 2 && template && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Record Identifier (optional)</label>
                    <input value={recordId} onChange={e => setRecordId(e.target.value)} placeholder="e.g. EMP-001, STU-2024-042"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                  </div>

                  {template.placeholders?.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Template Fields</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {template.placeholders.map(p => (
                          <div key={p.field_path}>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                              <code className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{`{{${p.field_path}}}`}</code>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${p.data_type === 'number' ? 'bg-blue-50 text-blue-500' : p.data_type === 'date' ? 'bg-purple-50 text-purple-500' : 'bg-gray-50 text-gray-400'}`}>{p.data_type}</span>
                            </label>
                            <input type={TYPE_INPUT[p.data_type] || 'text'} value={values[p.field_path] || ''}
                              onChange={e => setValues(v => ({ ...v, [p.field_path]: e.target.value }))}
                              placeholder={p.default_value || `Enter ${p.field_path.replace(/_/g, ' ')}`}
                              className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition ${values[p.field_path]?.trim() ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={doPreview} disabled={previewing}
                      className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
                      {previewing ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                      {previewing ? 'Loading...' : preview ? 'Refresh Preview' : 'Preview'}
                    </button>
                    <button onClick={doGenerate} disabled={!allFilled || generating}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 transition-colors">
                      {generating ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating...</> : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Generate PDF</>}
                    </button>
                  </div>

                  {preview && (
                    <div className="border border-blue-100 rounded-xl overflow-hidden mt-2">
                      <div className="px-4 py-2 bg-blue-50/30 border-b border-blue-100 flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-600">HTML Preview</p>
                        <span className="text-[10px] text-gray-400">Rendered from template body</span>
                      </div>
                      <div className="p-5 bg-white">
                        <div className="prose prose-sm max-w-none text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: preview }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — success */}
          {step === 3 && generated && (
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-emerald-100 bg-emerald-50/40 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm font-bold text-emerald-700">PDF Generated Successfully</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2">
                  {[
                    { label: 'Document ID', value: <span className="font-mono text-sm font-semibold text-gray-800 bg-white border border-gray-200 px-3 py-1 rounded-lg">{generated.doc_uuid}</span> },
                    { label: 'Status',      value: <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">Draft</span> },
                    { label: 'DB Record',   value: <span className="text-sm text-gray-700">ID #{generated.id} — saved to generated_docs</span> },
                    { label: 'Hash',        value: <span className="font-mono text-[10px] text-gray-500">Stored in file_hash column</span> },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{r.label}</span>
                      <div>{r.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <a href={`/api/documents/${generated.id}/download`} target="_blank" rel="noreferrer"
                    className="flex-1 bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-center flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download PDF
                  </a>
                  <button onClick={reset} className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
                    Generate Another
                  </button>
                  <a href="/documents" className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-center">
                    View Documents
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {template && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Selected Template</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{template.name}</p>
                  <p className="text-xs text-gray-400">{template.category} · v{template.version}</p>
                </div>
              </div>
              {template.placeholders?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Fields</span><span className="font-medium text-gray-700">{template.placeholders.length}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Filled</span><span className="font-medium text-emerald-600">{template.placeholders.filter(p => values[p.field_path]?.trim()).length} / {template.placeholders.length}</span></div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${template.placeholders.filter(p => values[p.field_path]?.trim()).length / template.placeholders.length * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Documents</p>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">{recentDocs.length}</span>
            </div>
            <div className="px-4 py-2.5 border-b border-gray-100">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {filteredDocs.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No documents yet</p>}
              {filteredDocs.map(d => (
                <div key={d.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-gray-600 truncate">{d.doc_uuid}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-500'}`}>{d.status}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{d.template_name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ════════════════════════════════════════════════════
          BULK GENERATION
      ════════════════════════════════════════════════════ */}
      {activeTab === 'bulk' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-4">

            {/* Template selector */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Step 1 — Select Template</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  All records in the CSV will use this template
                </p>
              </div>
              <select value={bulkTemplateId} onChange={e => setBulkTemplate(e.target.value)}
                className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm
                  bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">— Choose a template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category}) v{t.version}</option>
                ))}
              </select>
            </div>

            {/* CSV input */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Step 2 — Upload or Paste CSV</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    First row must be headers. Include a{' '}
                    <code className="bg-[var(--color-surface-raised)] px-1 rounded text-[10px]">record_identifier</code> column.
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#3b5bdb]
                  bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg cursor-pointer
                  hover:bg-indigo-100 transition-colors flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                  Upload CSV
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvFile}/>
                </label>
              </div>

              <textarea
                value={bulkRecords}
                onChange={e => handleCsvChange(e.target.value)}
                rows={8}
                placeholder={`record_identifier,employee_name,department,salary\nEMP-001,Abebe Bekele,Engineering,45000\nEMP-002,Tigist Haile,Finance,38000`}
                className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-xs font-mono
                  bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  placeholder-[var(--color-text-secondary)]
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
                  transition resize-none"
              />

              {bulkError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  {bulkError}
                </div>
              )}

              {/* CSV row preview */}
              {bulkParsed && (
                <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]
                    flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      Preview — {bulkParsed.rows.length} records
                    </p>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                      Valid CSV
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                          {bulkParsed.headers.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold
                              text-[var(--color-text-secondary)] whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {bulkParsed.rows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="hover:bg-[var(--color-surface-raised)]">
                            {bulkParsed.headers.map(h => (
                              <td key={h} className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                                {r.data[h] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {bulkParsed.rows.length > 5 && (
                          <tr>
                            <td colSpan={bulkParsed.headers.length}
                              className="px-3 py-2 text-[var(--color-text-secondary)] text-center italic">
                              … and {bulkParsed.rows.length - 5} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button onClick={submitBulkJob}
                disabled={!bulkTemplateId || !bulkParsed || bulkSubmitting}
                className="w-full flex items-center justify-center gap-2
                  bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                  py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors shadow-sm shadow-indigo-200">
                {bulkSubmitting
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>Starting job…</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                      </svg>
                      Generate {bulkParsed?.rows?.length || 0} Documents in Background
                    </>
                }
              </button>
            </div>
          </div>

          {/* Right — job progress list */}
          <div className="space-y-4">
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5">
              <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
                Bulk Jobs
              </p>
              {bulkJobs.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-8 h-8 text-[var(--color-border)] mx-auto mb-2"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                  <p className="text-xs text-[var(--color-text-secondary)]">No bulk jobs yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-none">
                  {bulkJobs.map(job => (
                    <BulkJobCard key={job.jobUuid} job={job} onDownload={downloadBulkZip}/>
                  ))}
                </div>
              )}
            </div>

            {/* How-to info card */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-[#3b5bdb] uppercase tracking-wide">How bulk works</p>
              {[
                'Upload a CSV with one record per row',
                'Each row generates one PDF in the background',
                'Progress updates every 2 seconds automatically',
                'Download all PDFs as a single .zip when done',
                'Max 500 records per job',
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#3b5bdb] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[8px] font-bold text-white">{i + 1}</span>
                  </div>
                  <p className="text-xs text-[#3b5bdb]/80">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
