/**
 * RepeatBlockEditor.jsx
 *
 * Properties panel section for REPEAT_BLOCK elements.
 * Lets the admin configure:
 *   - collection key (the array name in the data object, e.g. "items")
 *   - row template HTML (what renders for each item)
 *   - preview of the generated {{#each}}...{{/each}} syntax
 *
 * The HTML serialiser in TemplateEditorPage reads:
 *   el.collection, el.rowHtml
 * and produces:
 *   {{#each collection}}rowHtml{{/each}}
 *
 * Inside rowHtml the admin can use:
 *   {{this.fieldName}} or {{fieldName}}  — access item properties
 *   {{this}} — for primitive arrays
 *
 * Props:
 *   el          — repeat_block element
 *   onUpdate    — (patch) => void
 *   schema      — raw schema from GET /api/templates/schema (may be null)
 */

import { useState } from 'react';

const HIDDEN_TABLES = new Set([
  'audit_logs','bulk_jobs','delivery_logs','digital_signatures',
  'email_verifications','generated_docs','notifications',
  'password_reset_tokens','recipient_access_sessions',
  'signature_requests','system_settings','template_placeholders',
  'template_versions','templates','field_mappings',
]);

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
      {children}
    </div>
  );
}

function Block({ children }) {
  return <div style={{ marginBottom: 12 }}>{children}</div>;
}

// Sample collections that are commonly used
const COMMON_COLLECTIONS = [
  { key: 'items',       desc: 'Generic items array' },
  { key: 'rows',        desc: 'Table rows' },
  { key: 'allowances',  desc: 'Payroll allowances' },
  { key: 'deductions',  desc: 'Payroll deductions' },
  { key: 'subjects',    desc: 'Academic subjects' },
  { key: 'grades',      desc: 'Academic grades' },
  { key: 'transactions',desc: 'Finance transactions' },
];

export default function RepeatBlockEditor({ el, onUpdate, schema }) {
  const [showCollMenu, setShowCollMenu] = useState(false);
  const [showFieldMenu, setShowFieldMenu] = useState(false);

  const collection = el.collection || '';
  const rowHtml    = el.rowHtml    || '';

  // Build field list from schema for inserting {{this.field}} references
  const schemaFields = schema
    ? Object.entries(schema)
        .filter(([t]) => !HIDDEN_TABLES.has(t))
        .flatMap(([, cols]) => cols.map(c => c.field))
        .filter((v, i, a) => a.indexOf(v) === i)  // unique
    : [];

  // Insert a {{this.field}} reference at the cursor (appended for simplicity)
  const insertFieldRef = (field) => {
    onUpdate({ rowHtml: (rowHtml || '') + `{{this.${field}}}` });
    setShowFieldMenu(false);
  };

  const preview = collection
    ? [
        `{{#each ${collection}}}`,
        `  ${(rowHtml || '<p>…</p>').slice(0, 100)}`,
        `{{/each}}`,
      ].join('\n')
    : '(set a collection key above)';

  return (
    <div>
      {/* Collection key */}
      <Block>
        <Label>Collection Key</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={collection}
            onChange={e => onUpdate({ collection: e.target.value })}
            placeholder="e.g. items"
            style={{
              flex: 1, padding: '6px 8px', fontSize: 12,
              border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowCollMenu(v => !v)}
              style={{
                height: '100%', padding: '0 10px',
                background: '#f3f4f6', border: '1px solid #d1d5db',
                borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#374151',
              }}
            >
              Examples ▾
            </button>
            {showCollMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                zIndex: 200, width: 220, padding: '6px 0',
              }}>
                {COMMON_COLLECTIONS.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => { onUpdate({ collection: c.key }); setShowCollMenu(false); }}
                    style={{
                      display: 'flex', width: '100%', textAlign: 'left', gap: 8,
                      padding: '6px 12px', background: 'none', border: 'none',
                      cursor: 'pointer', alignItems: 'baseline',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: '#1e3a5f' }}>{c.key}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{c.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
          Name of the array in the generator's data. The template will loop over each item.
        </div>
      </Block>

      {/* Row template HTML */}
      <Block>
        <Label>Row Template HTML</Label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowFieldMenu(v => !v)}
              style={{
                padding: '3px 8px', fontSize: 10,
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 5, cursor: 'pointer', color: '#1d4ed8',
              }}
            >
              Insert {'{{this.field}}'} ▾
            </button>
            {showFieldMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                zIndex: 200, width: 200, maxHeight: 200, overflowY: 'auto',
                padding: '6px 0',
              }}>
                <button
                  type="button"
                  onClick={() => { onUpdate({ rowHtml: (rowHtml || '') + '{{this}}' }); setShowFieldMenu(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', color: '#1e3a5f' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  {'{{this}}'} — whole item
                </button>
                {schemaFields.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => insertFieldRef(f)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', color: '#374151' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    {`{{this.${f}}}`}
                  </button>
                ))}
                {schemaFields.length === 0 && (
                  <div style={{ padding: '8px 12px', fontSize: 11, color: '#9ca3af' }}>
                    Type any field name manually
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <textarea
          value={rowHtml}
          onChange={e => onUpdate({ rowHtml: e.target.value })}
          rows={5}
          placeholder={`<tr>\n  <td>{{this.name}}</td>\n  <td>{{this.amount}}</td>\n</tr>`}
          style={{
            width: '100%', padding: '7px 8px',
            fontSize: 11, fontFamily: 'monospace',
            border: '1px solid #d1d5db', borderRadius: 6,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
          HTML rendered once per item. Use <code>{'{{this.fieldName}}'}</code> to access item properties.
          Use <code>{'{{this}}'}</code> for primitive arrays.
        </div>
      </Block>

      {/* Quick-start templates */}
      <Block>
        <Label>Quick Start</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            {
              label: 'Table rows',
              html: '<tr>\n  <td>{{this.name}}</td>\n  <td>{{this.value}}</td>\n</tr>',
            },
            {
              label: 'Paragraph per item',
              html: '<p>{{this.description}}</p>',
            },
            {
              label: 'List item',
              html: '<li>{{this.item}}</li>',
            },
            {
              label: 'Payslip row',
              html: '<tr>\n  <td>{{this.description}}</td>\n  <td style="text-align:right">{{this.amount}}</td>\n</tr>',
            },
          ].map(q => (
            <button
              key={q.label}
              type="button"
              onClick={() => onUpdate({ rowHtml: q.html })}
              style={{
                padding: '5px 10px', fontSize: 11,
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 6, cursor: 'pointer', color: '#374151',
                textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </Block>

      {/* Generated HTML preview */}
      <Block>
        <Label>Generated Template Syntax</Label>
        <pre style={{
          margin: 0, padding: '8px 10px',
          background: '#0f172a', color: '#86efac',
          borderRadius: 7, fontSize: 10,
          fontFamily: 'monospace', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 120, overflowY: 'auto',
        }}>
          {preview}
        </pre>
      </Block>

      <div style={{
        fontSize: 10, color: '#9ca3af',
        padding: '8px 10px',
        background: '#f9fafb', borderRadius: 6,
        border: '1px solid #f0f0f0',
      }}>
        The generator must supply a <code>{collection || 'collection'}</code> array in the document data.
        If the array is empty or missing, this block renders nothing.
      </div>
    </div>
  );
}
