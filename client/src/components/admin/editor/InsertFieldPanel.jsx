/**
 * InsertFieldPanel.jsx
 *
 * A floating modal that shows schema fields from GET /api/templates/schema,
 * plus the static system/auto-date fields, grouped by table.
 *
 * When the user clicks a field, onInsert(placeholderString) is called.
 * The caller is responsible for creating the dynamic_field element with
 * the chosen placeholder.
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   onInsert      (placeholder: string, label: string) => void
 *   schema        object | null  — from GET /api/templates/schema
 *   schemaLoading boolean
 */

import { useState, useMemo } from 'react';

// ── Tables that must never appear in the picker ────────────────────────────────
const HIDDEN_TABLES = new Set([
  'audit_logs', 'bulk_jobs', 'delivery_logs', 'digital_signatures',
  'email_verifications', 'generated_docs', 'notifications',
  'password_reset_tokens', 'recipient_access_sessions',
  'signature_requests', 'system_settings', 'template_placeholders',
  'template_versions', 'templates', 'field_mappings',
]);

// ── Static system fields always available ──────────────────────────────────────
const SYSTEM_GROUPS = [
  {
    group: 'System (auto-filled)',
    fields: [
      { placeholder: '{{system.company_name}}',  label: 'Company Name',   hint: 'From platform settings' },
      { placeholder: '{{system.department}}',     label: 'Department',     hint: 'From platform settings' },
      { placeholder: '{{system.address}}',        label: 'Address',        hint: 'From platform settings' },
      { placeholder: '{{system.contact_email}}',  label: 'Contact Email',  hint: 'From platform settings' },
      { placeholder: '{{system.contact_phone}}',  label: 'Contact Phone',  hint: 'From platform settings' },
      { placeholder: '{{system.logo_url}}',       label: 'Company Logo',   hint: 'Image — renders as <img>' },
      { placeholder: '{{system.company_seal}}',   label: 'Company Seal',   hint: 'Image — renders as <img>' },
    ],
  },
  {
    group: 'Generation Date/Time',
    fields: [
      { placeholder: '{{generation_date}}',      label: 'Generation Date',     hint: 'e.g. September 2, 2026' },
      { placeholder: '{{generation_time}}',      label: 'Generation Time',     hint: 'e.g. 09:30 AM' },
      { placeholder: '{{generation_datetime}}',  label: 'Generation Datetime', hint: 'Full date + time' },
      { placeholder: '{{generation_year}}',      label: 'Year',               hint: 'e.g. 2026' },
      { placeholder: '{{generation_month}}',     label: 'Month',              hint: 'e.g. September' },
      { placeholder: '{{generation_day}}',       label: 'Day',               hint: 'e.g. 2' },
      { placeholder: '{{effective_date}}',       label: 'Effective Date',     hint: 'Set by generator' },
      { placeholder: '{{expiry_date}}',          label: 'Expiry Date',        hint: 'Set by generator' },
      { placeholder: '{{issue_date}}',           label: 'Issue Date',         hint: 'Set by generator' },
    ],
  },
  {
    group: 'Approver',
    fields: [
      { placeholder: '{{approver.full_name}}',       label: 'Approver Name',      hint: '' },
      { placeholder: '{{approver.email}}',           label: 'Approver Email',     hint: '' },
      { placeholder: '{{approver.role}}',            label: 'Approver Role',      hint: '' },
      { placeholder: '{{approver.department}}',      label: 'Approver Dept',      hint: '' },
      { placeholder: '{{approver.signature_image}}', label: 'Approver Signature', hint: 'Image — renders as <img>' },
    ],
  },
];

// ── Friendly column-name formatter ─────────────────────────────────────────────
function friendlyName(field) {
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Type badge ─────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const COLOR_MAP = {
    int:      '#dbeafe',
    varchar:  '#dcfce7',
    text:     '#fef9c3',
    datetime: '#ede9fe',
    tinyint:  '#fce7f3',
    enum:     '#ffedd5',
  };
  const bg = COLOR_MAP[type] || '#f3f4f6';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 5px',
      borderRadius: 4,
      fontSize: 9,
      fontWeight: 600,
      background: bg,
      color: '#374151',
      marginLeft: 4,
      verticalAlign: 'middle',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {type}
    </span>
  );
}

export default function InsertFieldPanel({ open, onClose, onInsert, schema, schemaLoading }) {
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');

  // Build dynamic groups from schema
  const dynamicGroups = useMemo(() => {
    if (!schema) return [];
    return Object.entries(schema)
      .filter(([table]) => !HIDDEN_TABLES.has(table))
      .map(([table, cols]) => ({
        group: table,
        fields: cols.map(c => ({
          placeholder: c.placeholder,
          label:       friendlyName(c.field),
          hint:        c.type,
          dataType:    c.type,
          field:       c.field,
        })),
      }))
      .filter(g => g.fields.length > 0);
  }, [schema]);

  const allGroups = [...dynamicGroups, ...SYSTEM_GROUPS];

  // Filter by search
  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) {
      if (activeGroup === 'all') return allGroups;
      return allGroups.filter(g => g.group === activeGroup);
    }
    return allGroups
      .map(g => ({
        ...g,
        fields: g.fields.filter(f =>
          f.placeholder.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.fields.length > 0);
  }, [search, activeGroup, allGroups]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 560, maxHeight: '80vh',
        background: '#ffffff', borderRadius: 12,
        boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Insert Dynamic Field</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Click a field to insert it as a placeholder
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search fields…"
            style={{
              width: '100%', padding: '7px 12px',
              fontSize: 13, border: '1px solid #d1d5db',
              borderRadius: 7, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Tab bar */}
        {!search && (
          <div style={{
            display: 'flex', gap: 0,
            padding: '6px 18px 0',
            borderBottom: '1px solid #e5e7eb',
            overflowX: 'auto',
            flexShrink: 0,
          }}>
            <TabBtn label="All" active={activeGroup === 'all'} onClick={() => setActiveGroup('all')} />
            {allGroups.map(g => (
              <TabBtn key={g.group} label={g.group} active={activeGroup === g.group} onClick={() => setActiveGroup(g.group)} />
            ))}
          </div>
        )}

        {/* Field list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 16px' }}>
          {schemaLoading && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 13 }}>
              Loading schema…
            </div>
          )}

          {!schemaLoading && filteredGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 13 }}>
              No fields match "{search}"
            </div>
          )}

          {filteredGroups.map(grp => (
            <div key={grp.group} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                marginBottom: 6,
              }}>
                {grp.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {grp.fields.map(f => (
                  <button
                    key={f.placeholder}
                    type="button"
                    onClick={() => { onInsert(f.placeholder, f.label); onClose(); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 7,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {f.label}
                        {f.dataType && <TypeBadge type={f.dataType} />}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1, fontFamily: 'monospace' }}>
                        {f.placeholder}
                      </div>
                    </div>
                    {f.hint && !f.dataType && (
                      <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8, flexShrink: 0 }}>{f.hint}</span>
                    )}
                    <span style={{ marginLeft: 8, color: '#2563eb', fontSize: 16, flexShrink: 0 }}>+</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid #f3f4f6',
          background: '#f9fafb',
          fontSize: 10,
          color: '#9ca3af',
          flexShrink: 0,
        }}>
          Fields are resolved at document generation time using live data. Placeholders remain editable in the template.
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        fontSize: 11, fontWeight: active ? 600 : 400,
        border: 'none',
        borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
        background: 'none',
        cursor: 'pointer',
        color: active ? '#2563eb' : '#6b7280',
        whiteSpace: 'nowrap',
        transition: 'color 0.1s',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}
