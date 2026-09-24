/**
 * FieldMappingPanel.jsx — FR-003
 *
 * Shows a two-column panel inside the template editor:
 *   Left  — template placeholders extracted live from the current header/body/footer HTML
 *   Right — data source columns fetched from the selected table (the same `fields` list
 *            that powers the existing draggable chips above the editors)
 *
 * Drag-and-drop mechanism (native HTML5, no library):
 *   • Drag source:  every row in the right-hand "Available fields" list is draggable,
 *     emitting the same two MIME types as the existing field chips so behaviour is
 *     consistent with dragging chips into the RichTextEditors.
 *   • Drop target:  each placeholder row in the left column is a drop zone.  Dropping
 *     a field onto a placeholder creates (or replaces) the mapping for that placeholder.
 *   • Remove:       a small ✕ button on a mapped row clears that mapping.
 *   • Clear all:    a link at the top of the panel resets all mappings.
 *
 * Storage (no DB schema change):
 *   Mappings are passed up to TemplateForm via the `onChange` callback and stored in
 *   `workflow_config.fieldMappings` — a plain object keyed by placeholder path:
 *     { "employees.full_name": { field_path, field_name, data_type }, ... }
 *   This is serialised into the existing `templates.workflow_config` JSON column and
 *   read back when the template is reopened in edit mode.
 *
 * Props:
 *   placeholders  [{field_path, data_type, is_loopable}]  — extracted from HTML
 *   fields        [{field_path, field_name, data_type}]   — from data source
 *   mappings      { [placeholderPath]: fieldObject }       — current saved state
 *   onChange      (newMappings) => void
 */

import { useState } from 'react';

// ─── Icons (inline SVG, stroke-based, 16×16 — consistent with RichTextEditor) ──

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 10.5 10.5 7.5" />
      <path d="M8 4.5 9.5 3a2.8 2.8 0 0 1 4 4L12 8.5M10 13.5 8.5 15a2.8 2.8 0 0 1-4-4L6 9.5" />
    </svg>
  );
}

function IconUnlink() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l12 12" />
      <path d="M8 4.5 9.5 3a2.8 2.8 0 0 1 4 4L12 8.5" />
      <path d="M10 13.5 8.5 15a2.8 2.8 0 0 1-4-4L6 9.5" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="5" height="12" rx="1" />
      <rect x="12" y="3" width="5" height="12" rx="1" />
      <path d="M6 9h6" />
      <path d="M10 7l2 2-2 2" />
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Strip the table prefix from a field_path for a compact display label.
 * "employees.full_name"  →  "full_name"
 * "generation_date"      →  "generation_date"   (no prefix)
 */
function shortName(fieldPath) {
  const dot = fieldPath.indexOf('.');
  return dot === -1 ? fieldPath : fieldPath.slice(dot + 1);
}

/** Data-type badge colours consistent with the project's design tokens. */
const TYPE_COLORS = {
  string:  { bg: 'var(--brand-light)',   text: 'var(--brand-text)' },
  number:  { bg: 'var(--amber-light)',   text: 'var(--amber-text)' },
  date:    { bg: '#EEF2FF',              text: '#3730A3'            },
  boolean: { bg: 'var(--bg-subtle)',     text: 'var(--text-muted)'  },
  json:    { bg: 'var(--bg-muted)',      text: 'var(--text-primary)'},
  // MySQL data types returned by information_schema
  varchar: { bg: 'var(--brand-light)',   text: 'var(--brand-text)' },
  int:     { bg: 'var(--amber-light)',   text: 'var(--amber-text)' },
  bigint:  { bg: 'var(--amber-light)',   text: 'var(--amber-text)' },
  decimal: { bg: 'var(--amber-light)',   text: 'var(--amber-text)' },
  float:   { bg: 'var(--amber-light)',   text: 'var(--amber-text)' },
  double:  { bg: 'var(--amber-light)',   text: 'var(--amber-text)' },
  datetime:{ bg: '#EEF2FF',              text: '#3730A3'            },
  timestamp:{bg: '#EEF2FF',              text: '#3730A3'            },
  tinyint: { bg: 'var(--bg-subtle)',     text: 'var(--text-muted)'  },
  text:    { bg: 'var(--brand-light)',   text: 'var(--brand-text)' },
  longtext:{ bg: 'var(--brand-light)',   text: 'var(--brand-text)' },
};

function TypeBadge({ type }) {
  const key = (type || 'string').toLowerCase();
  const c   = TYPE_COLORS[key] || TYPE_COLORS.string;
  return (
    <span style={{
      fontSize: '0.68rem', padding: '1px 6px', borderRadius: 8,
      background: c.bg, color: c.text,
      fontWeight: 600, letterSpacing: '0.02em',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {key}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────────

export default function FieldMappingPanel({ placeholders, fields, mappings, onChange }) {
  const [dragOverSlot, setDragOverSlot] = useState(null); // placeholder path being hovered

  // ── Drag event handlers ────────────────────────────────────────────────────────

  const handleDragStart = (e, field) => {
    // Same two MIME types as the existing field chips in TemplateForm —
    // consistency means any future DnD enhancements apply uniformly.
    e.dataTransfer.setData('text/plain', field.field_path);
    e.dataTransfer.setData('application/json', JSON.stringify(field));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e, placeholderPath) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverSlot(placeholderPath);
  };

  const handleDragLeave = () => setDragOverSlot(null);

  const handleDrop = (e, placeholderPath) => {
    e.preventDefault();
    setDragOverSlot(null);
    const rawJson  = e.dataTransfer.getData('application/json');
    const fieldPath = e.dataTransfer.getData('text/plain');
    if (!fieldPath) return;

    let fieldObj = null;
    if (rawJson) {
      try { fieldObj = JSON.parse(rawJson); } catch { /* fall through */ }
    }
    // Fallback: look up in the fields array by path if JSON wasn't available
    if (!fieldObj) {
      fieldObj = fields.find((f) => f.field_path === fieldPath) || { field_path: fieldPath, field_name: shortName(fieldPath), data_type: 'string' };
    }

    onChange({ ...mappings, [placeholderPath]: fieldObj });
  };

  const removeMapping = (placeholderPath) => {
    const next = { ...mappings };
    delete next[placeholderPath];
    onChange(next);
  };

  const clearAll = () => onChange({});

  const mappedCount = Object.keys(mappings).length;

  // ── Guard: nothing to show ─────────────────────────────────────────────────────
  if (placeholders.length === 0) {
    return (
      <div className="fmp-empty">
        <IconMap />
        <span>
          No placeholders detected yet. Add <code>{'{{field_name}}'}</code> tokens to the
          header, body, or footer editors — they will appear here for mapping.
        </span>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────────
  return (
    <div className="fmp-root">
      {/* Panel header */}
      <div className="fmp-header">
        <span className="fmp-header-title">
          <IconMap />
          Field Mapping
        </span>
        <span className="fmp-header-stat">
          {mappedCount}/{placeholders.length} mapped
        </span>
        {mappedCount > 0 && (
          <button type="button" className="fmp-clear-btn" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      <div className="fmp-body">
        {/* ── Left column: template placeholders (drop targets) ── */}
        <div className="fmp-col">
          <p className="fmp-col-heading">Template placeholders</p>
          <div className="fmp-slot-list">
            {placeholders.map((ph) => {
              const mapped    = mappings[ph.field_path];
              const isOver    = dragOverSlot === ph.field_path;
              const isLoopable = ph.is_loopable;

              return (
                <div
                  key={ph.field_path}
                  className={`fmp-slot${mapped ? ' fmp-slot-mapped' : ''}${isOver ? ' fmp-slot-dragover' : ''}`}
                  onDragOver={(e) => handleDragOver(e, ph.field_path)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, ph.field_path)}
                  aria-label={`Drop zone for ${ph.field_path}`}
                >
                  {/* Placeholder token label */}
                  <span className="fmp-ph-token" title={ph.field_path}>
                    <code>{`{{${shortName(ph.field_path)}}}`}</code>
                    {isLoopable && (
                      <span className="fmp-ph-badge">loop</span>
                    )}
                  </span>

                  {/* Mapping indicator */}
                  {mapped ? (
                    <span className="fmp-mapping-line">
                      <IconLink />
                      <span className="fmp-mapped-field" title={mapped.field_path}>
                        {mapped.field_name || shortName(mapped.field_path)}
                      </span>
                      <TypeBadge type={mapped.data_type} />
                      <button
                        type="button"
                        className="fmp-remove-btn"
                        onClick={() => removeMapping(ph.field_path)}
                        title={`Remove mapping for ${ph.field_path}`}
                        aria-label={`Remove mapping for ${ph.field_path}`}
                      >
                        <IconUnlink />
                      </button>
                    </span>
                  ) : (
                    <span className="fmp-drop-hint">
                      {isOver ? '↓ Drop to map' : 'Drop a field here'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="fmp-divider" aria-hidden="true" />

        {/* ── Right column: available data source fields (drag sources) ── */}
        <div className="fmp-col">
          <p className="fmp-col-heading">Available fields</p>
          {fields.length === 0 ? (
            <p className="fmp-no-fields">Select a data source table to see available fields.</p>
          ) : (
            <div className="fmp-field-list">
              {fields.map((f) => {
                // Grey out fields already used in at least one mapping
                const inUse = Object.values(mappings).some((m) => m.field_path === f.field_path);
                return (
                  <span
                    key={f.field_path}
                    className={`fmp-field-chip${inUse ? ' fmp-field-chip-used' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, f)}
                    title={inUse
                      ? `${f.field_name} is already mapped — drag again to remap a placeholder`
                      : `Drag onto a placeholder to map ${f.field_name}`}
                    aria-label={`Drag ${f.field_name} to map`}
                  >
                    <span className="fmp-field-name">{f.field_name}</span>
                    <TypeBadge type={f.data_type} />
                  </span>
                );
              })}
            </div>
          )}

          {/* ── NFR-005: PII filter reference ── */}
          <div className="fmp-filter-ref" aria-label="PII redaction filter reference">
            <p className="fmp-filter-ref-heading">
              <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="9" r="7" />
                <line x1="9" y1="8" x2="9" y2="13" />
                <circle cx="9" cy="5.5" r="0.6" fill="currentColor" stroke="none" />
              </svg>
              PII redaction filters
            </p>
            <p className="fmp-filter-ref-desc">
              Append a filter to any placeholder in the editor to mask sensitive data in the generated PDF.
            </p>
            <div className="fmp-filter-list">
              <div className="fmp-filter-item">
                <code className="fmp-filter-code">{'{{field|redact}}'}</code>
                <span className="fmp-filter-desc">Full mask — replaces the entire value with bullets (e.g. <samp>••••••••</samp>). Use for passwords, secret keys.</span>
              </div>
              <div className="fmp-filter-item">
                <code className="fmp-filter-code">{'{{field|redact:last4}}'}</code>
                <span className="fmp-filter-desc">Shows only the last 4 characters (e.g. <samp>••••••1234</samp>). Use for phone numbers, account numbers.</span>
              </div>
            </div>
            <p className="fmp-filter-ref-example">
              Example: <code>{'{{employee.phone|redact:last4}}'}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
