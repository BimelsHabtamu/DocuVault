import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from './RichTextEditor';
import FieldMappingPanel from './FieldMappingPanel';
import { dataSourceService, externalDbService, templateService } from '../../services/templateService';
import { useToast } from '../../hooks/useToast';

const CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];
const INTERNAL_SOURCE = 'internal';

const USER_TYPES = ['Employee', 'Student', 'Supplier', 'Customer', 'Other'];

/** Default workflow config — all steps off, no user type */
const DEFAULT_WORKFLOW = {
  enabled: false,
  userType: '',
  otpVerification:         true,
  viewDocument:            false,
  confirmOwnership:        true,
  download:                true,
  acknowledge:             false,
  userSignature:           false,
  signatureField:          null,  // { page, x, y, width, height, required, allowPhoto } — set by Admin
  requireResponse:         false,
  sendResponseToGenerator: false,
};

/** Small toggle row component rendered inline */
function WorkflowToggle({ id, label, description, checked, onChange, locked = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1 }}>
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontSize: '0.88rem', fontWeight: 600,
            color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: locked ? 'default' : 'pointer',
            marginBottom: description ? 2 : 0,
          }}
        >
          {label}
          {locked && (
            <span style={{
              marginLeft: 6, fontSize: '0.7rem', fontWeight: 500,
              color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>always on</span>
          )}
        </label>
        {description && (
          <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {description}
          </p>
        )}
      </div>
      {/* Toggle switch */}
      <div
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={locked ? -1 : 0}
        onClick={() => !locked && onChange(!checked)}
        onKeyDown={(e) => { if (!locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onChange(!checked); } }}
        style={{
          width: 38, height: 22, borderRadius: 11, flexShrink: 0,
          background: checked ? 'var(--accent)' : 'var(--bg-muted)',
          position: 'relative', cursor: locked ? 'default' : 'pointer',
          transition: 'background 0.2s',
          outline: 'none',
          opacity: locked ? 0.7 : 1,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 19 : 3,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'left 0.18s',
        }} />
      </div>
    </div>
  );
}
// Watermarking is entirely automatic and status-driven — never a template-level
// choice. Every unapproved document (draft/pending/rejected) always shows "DRAFT";
// once signed/delivered, the system stamps "FINAL" on its own. There is nothing to
// pick here, so no watermark field is exposed on this form at all — see
// resolveWatermarkForStatus in documentAssembler.js for the actual logic.

/**
 * Shared form for both Create and Edit modes.
 * mode="create" -> single "Create Template" button.
 * mode="edit"   -> "Update Template" + "Cancel" buttons, version shown read-only.
 */
export default function TemplateForm({
  mode = 'create', initialData = null, onSubmit, submitting, nameError = null, onNameChange,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Draft auto-save key — only used in create mode (edit mode has initialData)
  const DRAFT_KEY = 'docuvault_template_draft';
  const isCreate = mode === 'create' && !initialData;

  // Load from localStorage draft if creating a new template
  const savedDraft = isCreate ? (() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
  })() : null;

  const [name, setName] = useState(savedDraft?.name || initialData?.name || '');
  const [category, setCategory] = useState(savedDraft?.category || initialData?.category || CATEGORIES[0]);
  const [description, setDescription] = useState(savedDraft?.description || initialData?.description || '');
  const [dataSourceTable, setDataSourceTable] = useState(savedDraft?.dataSourceTable || initialData?.data_source_table || '');
  const [dataSourceConnectionId, setDataSourceConnectionId] = useState(
    initialData?.data_source_connection_id ? String(initialData.data_source_connection_id) :
    savedDraft?.dataSourceConnectionId || INTERNAL_SOURCE
  );
  const [headerHtml, setHeaderHtml] = useState(savedDraft?.headerHtml || initialData?.header_html || '');
  const [bodyHtml, setBodyHtml] = useState(savedDraft?.bodyHtml || initialData?.body_html || '');
  const [footerHtml, setFooterHtml] = useState(savedDraft?.footerHtml || initialData?.footer_html || '');
  const [dataSources, setDataSources] = useState([]);
  const [connections, setConnections] = useState([]);
  const [connectionTables, setConnectionTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [fields, setFields] = useState([]);

  // ── User Workflow config ──────────────────────────────────────────────────
  const [workflow, setWorkflow] = useState(() => {
    if (initialData?.workflow_config) {
      const wf = typeof initialData.workflow_config === 'string'
        ? JSON.parse(initialData.workflow_config)
        : initialData.workflow_config;
      return { ...DEFAULT_WORKFLOW, ...wf };
    }
    return { ...DEFAULT_WORKFLOW };
  });
  const [workflowOpen, setWorkflowOpen] = useState(
    // Auto-expand if already configured
    Boolean(initialData?.workflow_config && (
      typeof initialData.workflow_config === 'string'
        ? JSON.parse(initialData.workflow_config)?.enabled
        : initialData.workflow_config?.enabled
    ))
  );

  const setWf = (key, value) => setWorkflow(prev => ({ ...prev, [key]: value }));

  // ── Field Mappings state (FR-003) ─────────────────────────────────────────
  // Loaded from workflow_config.fieldMappings on edit, empty object on create.
  // Shape: { [placeholderPath]: { field_path, field_name, data_type } }
  const [fieldMappings, setFieldMappings] = useState(() => {
    if (initialData?.workflow_config) {
      const wf = typeof initialData.workflow_config === 'string'
        ? JSON.parse(initialData.workflow_config)
        : initialData.workflow_config;
      return wf?.fieldMappings || {};
    }
    return {};
  });

  // ── Company Seal state ─────────────────────────────────────────────────────
  // The company seal/stamp printed on the document footer beside the signature.
  // Stored in workflow_config.companySeal (persisted even when the workflow steps
  // are disabled, same as fieldMappings). When imageUrl is null the backend
  // auto-generates a round "rubber stamp" seal instead. See
  // documentAssembler.js buildCompanySealHtml.
  const [companySeal, setCompanySeal] = useState(() => {
    if (initialData?.workflow_config) {
      const wf = typeof initialData.workflow_config === 'string'
        ? JSON.parse(initialData.workflow_config)
        : initialData.workflow_config;
      return wf?.companySeal || { enabled: false, imageUrl: null, position: 'right', size: 110 };
    }
    return savedDraft?.companySeal || { enabled: false, imageUrl: null, position: 'right', size: 110 };
  });
  const setCs = (key, value) => setCompanySeal(prev => ({ ...prev, [key]: value }));

  /**
   * Extracts placeholder paths from the current HTML in all three editors.
   * Runs live as the user edits so the mapping panel always reflects the
   * current template content.  Filters out the auto-injected date tokens
   * (generation_date, etc.) which are never mapped to a data source column.
   */
  const AUTO_DATES = new Set([
    'generation_date', 'generation_date_gc', 'generation_date_ec',
    'effective_date',  'effective_date_gc',  'effective_date_ec',
  ]);

  const livePlaceholders = useMemo(() => {
    const combined = `${headerHtml || ''}${bodyHtml || ''}${footerHtml || ''}`;
    const matches  = combined.match(/\{\{\s*([#/]?[\w.]+)[^}]*\}\}/g) || [];
    const seen     = new Set();
    const result   = [];
    for (const raw of matches) {
      const inner     = raw.replace(/[{}]/g, '').trim();
      const firstTok  = inner.split(/\s+/)[0];
      if (firstTok.startsWith('#') || firstTok.startsWith('/')) continue;
      const clean     = firstTok.split('|')[0];
      if (AUTO_DATES.has(clean)) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      const isLoopable = clean.includes('[]') || clean.toLowerCase().includes('each');
      result.push({ field_path: clean, data_type: 'string', is_loopable: isLoopable ? 1 : 0 });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerHtml, bodyHtml, footerHtml]);

  // Refs wired to the Header/Footer RichTextEditors' imperative insert functions
  // (see RichTextEditor's insertBlockRef prop). Used so programmatic insertions
  // (logo upload into the header, "Add Signature Field" into the footer) go
  // through the browser's native undo stack, keeping Ctrl+Z working — injecting
  // via setState instead would rewrite the editor's innerHTML and lose undo.
  const headerInsertRef = useRef(null);
  const footerInsertRef = useRef(null);

  /**
   * Inserts the locked [[SIGNATURE_FIELD]] HTML block at the end of the footer
   * editor and records default signatureField config in workflow_config.
   * Idempotent — clicking a second time replaces the existing block.
   */
  const handleAddSignatureField = () => {
    // Remove any existing [[SIGNATURE_FIELD]] block from footerHtml first so
    // clicking the button twice doesn't duplicate it.
    const sigBlockStart = '<!-- [[SIGNATURE_FIELD]] -->';
    setFooterHtml(prev => {
      const idx = prev.indexOf(sigBlockStart);
      return idx !== -1 ? prev.slice(0, idx).trimEnd() : prev;
    });

    // The visual placeholder block that will be embedded in footer_html and
    // stored in the DB. The backend later replaces this entire comment-delimited
    // block with the actual signed name + image HTML at submission time.
    const sigBlockHtml = `
<div contenteditable="false" style="margin-top:16px;padding:12px 16px;border:1.5px dashed #0F766E;border-radius:6px;background:rgba(15,118,110,0.04);user-select:none;pointer-events:none;" data-sig-field="1">
  <!-- [[SIGNATURE_FIELD]] -->
  <table style="width:100%;border-collapse:collapse;font-family:inherit;">
    <tbody>
      <tr>
        <td style="padding:4px 8px 4px 0;width:38%;vertical-align:bottom;font-size:0.82rem;color:#475569;">
          <div style="border-bottom:1.5px solid #94A3B8;padding-bottom:3px;min-width:80px;">&nbsp;</div>
          <div style="margin-top:4px;font-size:0.72rem;color:#94A3B8;letter-spacing:0.04em;">Name</div>
        </td>
        <td style="padding:4px 0 4px 8px;width:62%;vertical-align:bottom;font-size:0.82rem;color:#475569;">
          <div style="border:1.5px solid #0F766E;border-radius:4px;min-height:36px;padding:4px 8px;background:#fff;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:0.75rem;color:#94A3B8;letter-spacing:0.04em;">[ SIGNATURE FIELD ]</span>
          </div>
          <div style="margin-top:4px;font-size:0.72rem;color:#94A3B8;letter-spacing:0.04em;">Signature</div>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:8px 0 0;font-size:0.82rem;color:#475569;vertical-align:bottom;">
          <div style="border-bottom:1.5px solid #94A3B8;padding-bottom:3px;">&nbsp;</div>
          <div style="margin-top:4px;font-size:0.72rem;color:#94A3B8;letter-spacing:0.04em;">Date</div>
        </td>
      </tr>
    </tbody>
  </table>
  <!-- [[/SIGNATURE_FIELD]] -->
</div>`;

    // Inject into the footer editor via the ref
    if (footerInsertRef.current) {
      footerInsertRef.current(sigBlockHtml);
    } else {
      // Fallback: editor not yet mounted — append to state directly
      setFooterHtml(prev => `${prev || ''}${sigBlockHtml}`);
    }

    // Write signatureField config into workflow_config (used by backend to locate
    // and replace the placeholder). No coordinate math needed — the position is
    // defined by the placeholder's place in the footer HTML itself.
    setWf('signatureField', {
      inFooter:   true,    // signals the "footer HTML replacement" strategy
      required:   true,
      allowPhoto: true,
      allowDraw:  true,
    });
    // Ensure userSignature and enabled are both on
    setWf('userSignature', true);
    setWorkflow(prev => ({ ...prev, enabled: true }));
    if (!workflowOpen) setWorkflowOpen(true);
  };

  const isExternalSource = dataSourceConnectionId !== INTERNAL_SOURCE;

  useEffect(() => {
    dataSourceService.getAll()
      .then((res) => setDataSources(res.data))
      .catch(() => showToast('Could not load data sources.', 'error'));
    externalDbService.list()
      .then((res) => setConnections(res.data || []))
      .catch(() => {}); // non-fatal — the internal source still works without this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft to localStorage (create mode only) ──────────────────
  // Saves 800ms after the last change. Restored when the page is reopened.
  // Cleared on successful submit so it doesn't reappear after saving.
  useEffect(() => {
    if (!isCreate) return;
    const draft = {
      name, category, description,
      dataSourceTable, dataSourceConnectionId,
      headerHtml, bodyHtml, footerHtml,
      companySeal,
      savedAt: new Date().toISOString(),
    };
    const timer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage quota */ }
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate, name, category, description, dataSourceTable, dataSourceConnectionId, headerHtml, bodyHtml, footerHtml, companySeal]);

  // Whenever the chosen external connection changes, fetch ONLY that connection's own
  // tables (backend re-enforces this — see listExternalTables). Switching back to
  // "internal" or to a different connection clears whatever table/fields were picked,
  // since a table name from one source has no meaning on another.
  useEffect(() => {
    if (!isExternalSource) { setConnectionTables([]); return; }
    let cancelled = false;
    setLoadingTables(true);
    externalDbService.getTables(dataSourceConnectionId)
      .then((res) => { if (!cancelled) setConnectionTables(res.data || []); })
      .catch((err) => { if (!cancelled) showToast(err.message || 'Failed to load tables for this connection.', 'error'); })
      .finally(() => { if (!cancelled) setLoadingTables(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceConnectionId]);

  const handleSourceChange = (e) => {
    setDataSourceConnectionId(e.target.value);
    setDataSourceTable(''); // a table picked under the old source no longer applies
  };

  useEffect(() => {
    if (!dataSourceTable) {
      setFields([]);
      return;
    }
    const fetchFields = isExternalSource
      ? externalDbService.getFields(dataSourceConnectionId, dataSourceTable)
      : dataSourceService.getFields(dataSourceTable);
    fetchFields
      .then((res) => setFields(res.data))
      .catch(() => setFields([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceTable, isExternalSource, dataSourceConnectionId]);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPosition, setLogoPosition] = useState('left'); // 'left' | 'center' | 'right'
  const [uploadingSeal, setUploadingSeal] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await templateService.uploadLogo(file);
      // Wrap the image in a block-level paragraph so text-align controls its
      // horizontal position inside the header editor — left, center, or right —
      // without affecting any other content already in the header. The inner
      // <span class="rte-image-wrap"> keeps it resizable by dragging its corner,
      // consistent with images inserted via the editor's own Image button.
      const alignStyle = `text-align:${logoPosition};display:block;`;
      const html = `<p style="${alignStyle}"><span class="rte-image-wrap" contenteditable="false" style="display:inline-block;width:180px;resize:both;overflow:hidden;max-width:100%;border:1px dashed transparent;"><img src="${res.data.url}" style="width:100%;height:100%;display:block;" alt="Logo" /></span></p>`;
      if (headerInsertRef.current) {
        // Insert at the top of the header editor through the native undo stack,
        // so Ctrl+Z / Ctrl+Y can revert the logo like any other editor action.
        headerInsertRef.current(html, { at: 'start' });
      } else {
        // Fallback: header editor not mounted yet — prepend to state directly.
        setHeaderHtml((prev) => `${html}${prev || ''}`);
      }
      showToast(`Logo uploaded — aligned ${logoPosition}. Drag its corner to resize.`, 'success');
    } catch (err) {
      showToast(err.message || 'Logo upload failed.', 'error');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  /** Strips tags/entities down to visible text, so an editor holding only "<p><br></p>" reads as empty. */
  const isEditorEmpty = (html) => !html || !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();

  /** Uploads a company seal image (reuses the logo upload endpoint — same multipart shape). */
  const handleSealUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSeal(true);
    try {
      const res = await templateService.uploadLogo(file);
      setCompanySeal(prev => ({ ...prev, enabled: true, imageUrl: res.data.url }));
      showToast('Company seal uploaded.', 'success');
    } catch (err) {
      showToast(err.message || 'Seal upload failed.', 'error');
    } finally {
      setUploadingSeal(false);
      e.target.value = '';
    }
  };

  const handleRemoveSeal = () => {
    setCompanySeal(prev => ({ ...prev, imageUrl: null, enabled: false }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // "All parts must be filled" — every field on the form is required before a
    // template can be created, not just name/category.
    if (!name.trim()) { showToast('Template name is required.', 'error'); return; }
    if (!category) { showToast('Category is required.', 'error'); return; }
    if (!description.trim()) { showToast('Description is required.', 'error'); return; }
    if (!dataSourceTable) { showToast('Choose a data source table.', 'error'); return; }
    if (isEditorEmpty(headerHtml)) { showToast('Header content is required.', 'error'); return; }
    if (isEditorEmpty(bodyHtml)) { showToast('Body content is required.', 'error'); return; }
    if (isEditorEmpty(footerHtml)) { showToast('Footer content is required.', 'error'); return; }

    onSubmit({
      name: name.trim(),
      category,
      description,
      data_source_table: dataSourceTable || null,
      data_source_connection_id: isExternalSource ? Number(dataSourceConnectionId) : null,
      watermark_text: null, // system-inserted only — DRAFT until signed, then FINAL automatically
      header_html: headerHtml,
      body_html: bodyHtml,
      footer_html: footerHtml,
      // FR-003: fieldMappings are always persisted in workflow_config so they survive
      // round-trips even when the workflow steps themselves are disabled.
      workflow_config: {
        ...(workflow.enabled ? workflow : {}),
        companySeal: companySeal?.enabled ? companySeal : undefined,
        fieldMappings: Object.keys(fieldMappings).length > 0 ? fieldMappings : undefined,
      },
    });
    // Clear the draft — template was saved successfully
    if (isCreate) {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
  };

  const handleCancel = () => navigate('/templates');

  const handleClearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    // Reset all fields
    setName(''); setCategory(CATEGORIES[0]); setDescription('');
    setDataSourceTable(''); setDataSourceConnectionId(INTERNAL_SOURCE);
    setHeaderHtml(''); setBodyHtml(''); setFooterHtml('');
    setCompanySeal({ enabled: false, imageUrl: null, position: 'right', size: 110 });
  };

  return (
    <form className="template-form" onSubmit={handleSubmit} noValidate>

      {/* Draft restored banner */}
      {isCreate && savedDraft?.name && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'var(--warn-bg)', border: '1px solid var(--warn-border)',
          color: 'var(--warn-text)', borderRadius: 8, padding: '10px 14px',
          fontSize: '0.85rem', marginBottom: 4,
        }}>
          <span>
            <strong>Draft restored</strong> — your unsaved work from{' '}
            {savedDraft.savedAt ? new Date(savedDraft.savedAt).toLocaleString() : 'a previous session'} was recovered.
          </span>
          <button type="button" onClick={handleClearDraft}
            style={{ background: 'none', border: '1px solid var(--warn-border)', borderRadius: 6,
              padding: '3px 10px', cursor: 'pointer', color: 'var(--warn-text)', fontSize: '0.78rem',
              fontWeight: 600, whiteSpace: 'nowrap' }}>
            Discard draft
          </button>
        </div>
      )}
      <div className="template-form-meta">
        <div className="form-field">
          <label htmlFor="tpl-name">Template Name <span className="required-mark">*</span></label>
          <input
            id="tpl-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              onNameChange?.();
            }}
            className={nameError ? 'field-invalid' : ''}
            aria-invalid={nameError ? 'true' : 'false'}
            required
          />
          {nameError && <p className="field-error">{nameError}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="tpl-category">Category <span className="required-mark">*</span></label>
          <select id="tpl-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="tpl-version">Version</label>
          <input id="tpl-version" value={mode === 'edit' ? `v${initialData?.version} → v${initialData.version + 1} (on save)` : 'v1'} disabled />
        </div>

        <div className="form-field">
          <label htmlFor="tpl-source">Source Database</label>
          <select id="tpl-source" value={dataSourceConnectionId} onChange={handleSourceChange}>
            <option value={INTERNAL_SOURCE}>This System (internal)</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.db_type})</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="tpl-datasource">Data Source Table <span className="required-mark">*</span></label>
          <select
            id="tpl-datasource"
            value={dataSourceTable}
            onChange={(e) => setDataSourceTable(e.target.value)}
            className={dataSourceTable ? '' : 'field-invalid'}
            disabled={isExternalSource && loadingTables}
          >
            <option value="">{isExternalSource && loadingTables ? 'Loading tables…' : '— choose a table —'}</option>
            {(isExternalSource ? connectionTables : dataSources).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-field form-field-wide">
          <label htmlFor="tpl-description">Description <span className="required-mark">*</span></label>
          <textarea id="tpl-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} required />
        </div>

      </div>

      {dataSourceTable && isExternalSource && (
        <p className="ext-db-preview-note">
          Columns for &quot;{dataSourceTable}&quot; are loaded below from the external connection, so you can build the
          template against them. A row-level data preview isn't available for external sources here.
        </p>
      )}

      {fields.length > 0 && (
        <div className="form-field">
          <div className="field-chip-row">
            {fields.map((f) => {
              const isList = f.data_type === 'json';
              return (
                <span
                  key={f.field_path}
                  className={`field-chip${isList ? ' field-chip-list' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', f.field_path);
                    e.dataTransfer.setData('application/json', JSON.stringify(f));
                  }}
                  title={isList
                    ? `"${f.field_name}" is a list — dragging it inserts a {{#each}} loop block instead of a plain placeholder.`
                    : `Drag into an editor to insert {{${f.field_path}}}`}
                >
                  {f.field_name}{isList && <span className="field-chip-badge">list</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FR-003: Field Mapping Panel ────────────────────────────────────────
          Shows template placeholders (extracted live from current HTML) on the
          left and data source columns on the right. Drag a column chip onto a
          placeholder row to create an explicit mapping. Mappings are stored in
          workflow_config.fieldMappings and persisted with the template.          */}
      {dataSourceTable && (
        <div className="form-field">
          <FieldMappingPanel
            placeholders={livePlaceholders}
            fields={fields}
            mappings={fieldMappings}
            onChange={setFieldMappings}
          />
        </div>
      )}

      <div className="form-field">
        <div className="rte-header-row">
          <label>Header <span className="required-mark">*</span></label>
          <div className="logo-upload-row" role="group" aria-label="Logo upload controls">
            {/* Position picker */}
            <div className="logo-pos-group" role="group" aria-label="Logo position">
              {[
                { value: 'left',   title: 'Align left',
                  icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><line x1="1" y1="4" x2="10" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="1" y1="12" x2="8" y2="12"/></svg> },
                { value: 'center', title: 'Align center',
                  icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="4" x2="13" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="4" y1="12" x2="12" y2="12"/></svg> },
                { value: 'right',  title: 'Align right',
                  icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><line x1="6" y1="4" x2="15" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="8" y1="12" x2="15" y2="12"/></svg> },
              ].map(({ value, title, icon }) => (
                <button
                  key={value}
                  type="button"
                  title={title}
                  aria-label={title}
                  aria-pressed={logoPosition === value}
                  className={`logo-pos-btn${logoPosition === value ? ' logo-pos-btn-active' : ''}`}
                  onClick={() => setLogoPosition(value)}
                >
                  {icon}
                </button>
              ))}
            </div>
            {/* Upload trigger */}
            <label className={`btn-secondary logo-upload-btn${uploadingLogo ? ' logo-upload-btn-busy' : ''}`}>
              {uploadingLogo ? 'Uploading…' : '+ Upload Logo / Signature'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
        <RichTextEditor value={headerHtml} onChange={setHeaderHtml} availableFields={fields} region="header" insertBlockRef={headerInsertRef} />
      </div>

      <div className="form-field">
        <label>Body <span className="required-mark">*</span></label>
        <RichTextEditor value={bodyHtml} onChange={setBodyHtml} availableFields={fields} region="body" />
      </div>

      <div className="form-field">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
          <label style={{ marginBottom: 0 }}>Footer <span className="required-mark">*</span></label>
          {workflow.enabled && workflow.userSignature && (
            <button
              type="button"
              onClick={handleAddSignatureField}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
                background: workflow.signatureField?.inFooter ? 'var(--brand-light)' : 'var(--brand)',
                color: workflow.signatureField?.inFooter ? 'var(--brand-text)' : '#fff',
                border: workflow.signatureField?.inFooter ? '1.5px solid var(--brand)' : 'none',
                borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background .15s',
              }}
              title="Insert the Admin-locked signature area into the footer. Users can only sign inside this box."
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {workflow.signatureField?.inFooter
                  ? <><polyline points="20 6 9 17 4 12"/></>
                  : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
              </svg>
              {workflow.signatureField?.inFooter ? 'Signature Field Added' : 'Add Signature Field'}
            </button>
          )}
        </div>
        <RichTextEditor
          value={footerHtml}
          onChange={setFooterHtml}
          availableFields={fields}
          region="footer"
          insertBlockRef={footerInsertRef}
        />
        {/* Locked-field indicator shown after insertion */}
        {workflow.signatureField?.inFooter && (
          <div style={{
            marginTop: 8, padding: '8px 12px',
            background: 'var(--brand-light)', border: '1px solid var(--border)',
            borderRadius: 6, fontSize: '0.77rem', color: 'var(--brand-text)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>
              <strong>Signature field locked.</strong> The user can only sign inside the boxed area in the footer above.
              They cannot move, resize, or remove it.
              {workflow.signatureField?.allowPhoto && ' Photo upload and drawing are enabled.'}
            </span>
          </div>
        )}
      </div>

      {/* ── Company Seal (footer stamp) ────────────────────────────────────── */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '14px 18px',
          background: companySeal.enabled ? 'rgba(21,154,156,0.06)' : 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>
            </svg>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Company Seal
            </span>
            {companySeal.enabled && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--accent)',
                background: 'rgba(21,154,156,0.12)', padding: '2px 8px', borderRadius: 20,
              }}>Enabled</span>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 20px 20px' }}>
          <WorkflowToggle
            id="seal-enabled"
            label="Add company seal to the document footer"
            description="Prints the company seal next to the signature line at the bottom of every generated document — alongside the system verification stamp."
            checked={companySeal.enabled}
            onChange={(v) => setCs('enabled', v)}
          />

          {companySeal.enabled && (
            <div style={{ marginTop: 14, paddingTop: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Seal artwork: uploaded image OR auto-generated fallback */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {companySeal.imageUrl && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={companySeal.imageUrl}
                      alt="Company seal"
                      style={{
                        width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
                        border: '2px solid rgba(15,39,71,0.5)', boxShadow: '0 0 0 3px #fff, 0 0 0 4px rgba(15,39,71,0.25)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveSeal}
                      title="Remove uploaded seal (system will auto-generate one instead)"
                      aria-label="Remove uploaded seal"
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 22, height: 22, borderRadius: '50%', border: 'none',
                        background: '#DC2626', color: '#fff', fontSize: '0.75rem',
                        lineHeight: 1, cursor: 'pointer', fontWeight: 700,
                      }}
                    >×</button>
                  </div>
                )}

                <label className={`btn-secondary logo-upload-btn${uploadingSeal ? ' logo-upload-btn-busy' : ''}`}
                  style={{ flexShrink: 0 }}>
                  {companySeal.imageUrl ? 'Replace Seal Image' : uploadingSeal ? 'Uploading…' : '+ Upload Seal Image'}
                  <input type="file" accept="image/*" onChange={handleSealUpload} disabled={uploadingSeal} style={{ display: 'none' }} />
                </label>
              </div>

              <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {companySeal.imageUrl
                  ? 'Your uploaded seal will be stamped on the footer in a circular frame.'
                  : 'No image uploaded — the system will auto-generate a round "rubber stamp" seal with the organization name, document ID and date.'}
              </p>

              {/* Position + size */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Seal position
                  </div>
                  <div className="logo-pos-group" role="group" aria-label="Company seal position" style={{ display: 'inline-flex' }}>
                    {[
                      { value: 'left',   title: 'Left of the signature' },
                      { value: 'center', title: 'Centered above the signature' },
                      { value: 'right',  title: 'Right of the signature' },
                    ].map(({ value, title }) => (
                      <button
                        key={value}
                        type="button"
                        title={title}
                        aria-label={title}
                        aria-pressed={companySeal.position === value}
                        className={`logo-pos-btn${companySeal.position === value ? ' logo-pos-btn-active' : ''}`}
                        onClick={() => setCs('position', value)}
                      >{value}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="seal-size" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Seal size
                  </label>
                  <select
                    id="seal-size"
                    value={companySeal.size}
                    onChange={(e) => setCs('size', Number(e.target.value))}
                    style={{ width: '100%', maxWidth: 160 }}
                  >
                    {[80, 100, 120, 140].map((s) => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── User Workflow Configuration ───────────────────────────────────── */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 4,
      }}>
        {/* Header / collapse toggle */}
        <button
          type="button"
          onClick={() => setWorkflowOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
            padding: '14px 18px',
            background: workflow.enabled ? 'rgba(21,154,156,0.06)' : 'var(--bg-subtle)',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            borderBottom: workflowOpen ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              User Workflow
            </span>
            {workflow.enabled && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--accent)',
                background: 'rgba(21,154,156,0.12)', padding: '2px 8px', borderRadius: 20,
              }}>Configured</span>
            )}
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: workflowOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {workflowOpen && (
          <div style={{ padding: '18px 20px 20px' }}>

            {/* Enable / disable the whole workflow */}
            <WorkflowToggle
              id="wf-enabled"
              label="Enable User Workflow for this template"
              description="When enabled, recipients will see a guided workflow portal instead of the standard download page."
              checked={workflow.enabled}
              onChange={(v) => setWf('enabled', v)}
            />

            {workflow.enabled && (
              <>
                {/* User Type */}
                <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <label htmlFor="wf-user-type" style={{
                    display: 'block', fontSize: '0.88rem', fontWeight: 600,
                    color: 'var(--text-primary)', marginBottom: 6,
                  }}>
                    User / Recipient Type
                  </label>
                  <p style={{ margin: '0 0 8px', fontSize: '0.77rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Classifies who the recipient is — used for display and future reporting.
                  </p>
                  <select
                    id="wf-user-type"
                    value={workflow.userType}
                    onChange={e => setWf('userType', e.target.value)}
                    style={{ width: '100%', maxWidth: 260 }}
                  >
                    <option value="">— select —</option>
                    {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Step toggles */}
                <div style={{ margin: '4px 0 0' }}>
                  <p style={{
                    margin: '10px 0 4px', fontSize: '0.75rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)',
                  }}>
                    Workflow Steps
                  </p>

                  <WorkflowToggle
                    id="wf-otp"
                    label="OTP Verification"
                    description="Recipient must enter a one-time code before accessing the document."
                    checked={true}
                    locked
                  />
                  <WorkflowToggle
                    id="wf-view"
                    label="View Document"
                    description="Show the document inline before any action is taken."
                    checked={workflow.viewDocument}
                    onChange={v => setWf('viewDocument', v)}
                  />
                  <WorkflowToggle
                    id="wf-ownership"
                    label="Confirm Ownership"
                    description="Recipient must confirm the document is intended for them."
                    checked={true}
                    locked
                  />
                  <WorkflowToggle
                    id="wf-download"
                    label="Download"
                    description="Allow the recipient to download the final document."
                    checked={true}
                    locked
                  />
                  <WorkflowToggle
                    id="wf-ack"
                    label="Acknowledge"
                    description="Recipient must explicitly acknowledge receipt before downloading."
                    checked={workflow.acknowledge}
                    onChange={v => setWf('acknowledge', v)}
                  />
                  <WorkflowToggle
                    id="wf-sign"
                    label="User Signature"
                    description="Recipient digitally signs the document, then submits it back to the Generator for review."
                    checked={workflow.userSignature}
                    onChange={v => {
                      setWf('userSignature', v);
                      if (!v) setWf('signatureField', null);
                    }}
                  />

                  {/* ── Signature Field — footer-integrated ── */}
                  {workflow.userSignature && (
                    <div style={{
                      margin: '0 0 4px', padding: '14px 16px',
                      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}>
                      {workflow.signatureField?.inFooter ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#15803D' }}>
                              Signature field added to footer
                            </p>
                          </div>
                          <p style={{ margin: '0 0 12px', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            The locked signature area is embedded in the footer above. Users must sign inside it —
                            they cannot move, resize, or remove it.
                          </p>
                          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={workflow.signatureField?.allowPhoto !== false}
                                onChange={e => setWf('signatureField', { ...workflow.signatureField, allowPhoto: e.target.checked })}
                                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                              />
                              Allow signature photo upload
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={workflow.signatureField?.allowDraw !== false}
                                onChange={e => setWf('signatureField', { ...workflow.signatureField, allowDraw: e.target.checked })}
                                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                              />
                              Allow drawing signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={workflow.signatureField?.required !== false}
                                onChange={e => setWf('signatureField', { ...workflow.signatureField, required: e.target.checked })}
                                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                              />
                              Required (user must sign before submitting)
                            </label>
                          </div>
                        </>
                      ) : (
                        <>
                          <p style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Add Signature Field to Footer
                          </p>
                          <p style={{ margin: '0 0 12px', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            Use the <strong>"Add Signature Field"</strong> button above the Footer editor to insert
                            the locked signature area into the footer. The user will sign inside that exact box
                            and cannot move or resize it.
                          </p>
                          <button
                            type="button"
                            onClick={handleAddSignatureField}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600,
                              background: 'var(--brand)', color: '#fff',
                              border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Add Signature Field to Footer
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <WorkflowToggle
                    id="wf-require-response"
                    label="Require Response"
                    description="Recipient must provide a written response or comment."
                    checked={workflow.requireResponse}
                    onChange={v => {
                      setWf('requireResponse', v);
                      if (v) setWf('sendResponseToGenerator', true);
                    }}
                  />
                  <WorkflowToggle
                    id="wf-send-response"
                    label="Send Response Back to Generator"
                    description="Recipient's response or signature is emailed back to the document issuer."
                    checked={workflow.sendResponseToGenerator}
                    onChange={v => setWf('sendResponseToGenerator', v)}
                  />
                </div>

                {/* Preview summary */}
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: 'var(--bg-subtle)', borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7,
                }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 3 }}>
                    Portal flow for this template:
                  </strong>
                  {[
                    'OTP Verification',
                    workflow.viewDocument      && 'View Document',
                    'Confirm Ownership',
                    workflow.acknowledge       && 'Acknowledge',
                    workflow.userSignature     && 'User Signs → Submitted to Generator',
                    workflow.requireResponse   && 'Recipient Response',
                    workflow.sendResponseToGenerator && '→ Response sent to generator',
                    'Download',
                  ].filter(Boolean).join('  →  ')}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="template-form-actions">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Saving…' : mode === 'edit' ? 'Update Template' : 'Create Template'}
        </button>
        {mode === 'edit' && (
          <button type="button" onClick={handleCancel} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
