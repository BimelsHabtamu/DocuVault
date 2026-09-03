/**
 * ConditionalBlockEditor.jsx
 *
 * Properties panel section for CONDITIONAL_BLOCK elements.
 * Lets the admin configure:
 *   - condition key (from schema picker or typed)
 *   - show when: truthy | falsy (stored in element but truthy is the server-native path)
 *   - else content (optional — stored as elseContent HTML string on the element)
 *   - child elements list (future: drag-drop children; for now the admin adds children
 *     via "Add to block" button which appends text/field elements inside the block)
 *
 * The HTML serialiser in TemplateEditorPage reads:
 *   el.condition, el.showWhen, el.bodyHtml, el.elseHtml
 * and produces:
 *   {{#if condition}}bodyHtml{{else}}elseHtml{{/if}}
 *   — or for showWhen:'falsy' —
 *   {{#if condition}}{{else}}bodyHtml{{/if}}
 *
 * Props:
 *   el          — conditional_block element
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

function Block({ children, style }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

export default function ConditionalBlockEditor({ el, onUpdate, schema }) {
  const [showSchemaMenu, setShowSchemaMenu] = useState(false);

  // Build a flat field list for the condition key picker
  const schemaFields = schema
    ? Object.entries(schema)
        .filter(([t]) => !HIDDEN_TABLES.has(t))
        .flatMap(([table, cols]) =>
          cols.map(c => ({
            placeholder: c.placeholder,        // {{table.col}}
            key:         `${table}.${c.field}`, // dotted key for {{#if key}}
            label:       `${table}.${c.field}`,
          }))
        )
    : [];

  // Auto-date / system keys usable as conditions
  const systemConditionKeys = [
    'generation_date', 'generation_year',
    'system.company_name', 'approver.full_name',
  ];

  // Preview what the HTML output will look like
  const condition  = el.condition || '';
  const showWhen   = el.showWhen  || 'truthy';
  const bodyHtml   = el.bodyHtml  || '<p>(content here)</p>';
  const elseHtml   = el.elseHtml  || '';

  // Build preview string
  const preview = condition
    ? showWhen === 'truthy'
      ? `{{#if ${condition}}}\n  ${bodyHtml.slice(0, 60)}…\n${elseHtml ? `{{else}}\n  ${elseHtml.slice(0,40)}…\n` : ''}{{/if}}`
      : `{{#if ${condition}}}\n{{else}}\n  ${bodyHtml.slice(0, 60)}…\n{{/if}}`
    : '(set a condition key above)';

  return (
    <div>
      {/* Condition key */}
      <Block>
        <Label>Condition Key</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={condition}
            onChange={e => onUpdate({ condition: e.target.value })}
            placeholder="e.g. finance.salary"
            style={{
              flex: 1, padding: '6px 8px', fontSize: 12,
              border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              title="Pick from schema"
              onClick={() => setShowSchemaMenu(v => !v)}
              style={{
                height: '100%', padding: '0 10px',
                background: '#f3f4f6', border: '1px solid #d1d5db',
                borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#374151',
              }}
            >
              Schema ▾
            </button>
            {showSchemaMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                zIndex: 200, width: 260, maxHeight: 240, overflowY: 'auto',
                padding: '6px 0',
              }}>
                {schemaFields.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => { onUpdate({ condition: f.key }); setShowSchemaMenu(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 12px', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: 11, color: '#374151',
                      fontFamily: 'monospace',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
          The block shows/hides based on whether this key has a value.
          Use dotted keys like <code>finance.salary</code> or <code>employee.department</code>.
        </div>
      </Block>

      {/* Show when */}
      <Block>
        <Label>Show Block When</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { value: 'truthy', label: 'Has value (truthy)',   desc: '{{#if key}} … {{/if}}' },
            { value: 'falsy',  label: 'Is empty (falsy)',     desc: '{{#if key}}{{else}} … {{/if}}' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ showWhen: opt.value })}
              title={opt.desc}
              style={{
                flex: 1, padding: '6px 8px', fontSize: 11,
                border: `1px solid ${showWhen === opt.value ? '#2563eb' : '#d1d5db'}`,
                borderRadius: 6, background: showWhen === opt.value ? '#eff6ff' : '#fff',
                color: showWhen === opt.value ? '#1d4ed8' : '#374151',
                cursor: 'pointer', fontWeight: showWhen === opt.value ? 600 : 400,
                transition: 'all 0.1s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Block>

      {/* Body HTML — what renders in the TRUE branch */}
      <Block>
        <Label>{showWhen === 'truthy' ? 'Content (when condition is true)' : 'Content (when condition is false)'}</Label>
        <textarea
          value={el.bodyHtml || ''}
          onChange={e => onUpdate({ bodyHtml: e.target.value })}
          rows={4}
          placeholder={`<p>Content shown when "${condition || 'key'}" ${showWhen === 'truthy' ? 'has a value' : 'is empty'}</p>`}
          style={{
            width: '100%', padding: '7px 8px',
            fontSize: 11, fontFamily: 'monospace',
            border: '1px solid #d1d5db', borderRadius: 6,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
          HTML content. Use <code>{'{{field}}'}</code> placeholders inside. Supports full template syntax.
        </div>
      </Block>

      {/* Else HTML — optional */}
      <Block>
        <Label>Else Content (optional)</Label>
        <textarea
          value={el.elseHtml || ''}
          onChange={e => onUpdate({ elseHtml: e.target.value })}
          rows={3}
          placeholder="<p>Content shown in the opposite case (optional)</p>"
          style={{
            width: '100%', padding: '7px 8px',
            fontSize: 11, fontFamily: 'monospace',
            border: '1px solid #d1d5db', borderRadius: 6,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </Block>

      {/* Generated HTML preview */}
      <Block>
        <Label>Generated Template Syntax</Label>
        <pre style={{
          margin: 0, padding: '8px 10px',
          background: '#0f172a', color: '#7dd3fc',
          borderRadius: 7, fontSize: 10,
          fontFamily: 'monospace', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 120, overflowY: 'auto',
        }}>
          {condition
            ? showWhen === 'truthy'
              ? [
                  `{{#if ${condition}}}`,
                  `  ${(el.bodyHtml || '<p>…</p>').slice(0, 80)}`,
                  el.elseHtml ? `{{else}}\n  ${el.elseHtml.slice(0, 60)}` : null,
                  `{{/if}}`,
                ].filter(Boolean).join('\n')
              : [
                  `{{#if ${condition}}}`,
                  el.elseHtml ? `{{else}}\n  ${el.elseHtml.slice(0, 60)}` : '{{else}}',
                  `  ${(el.bodyHtml || '<p>…</p>').slice(0, 80)}`,
                  `{{/if}}`,
                ].join('\n')
            : '(set a condition key to preview)'
          }
        </pre>
      </Block>

      {/* Dimension hint */}
      <div style={{
        fontSize: 10, color: '#9ca3af',
        padding: '8px 10px',
        background: '#f9fafb', borderRadius: 6,
        border: '1px solid #f0f0f0',
      }}>
        This block renders as a conditional section in the PDF. Its canvas height is just for visual placement — the actual PDF height expands with content.
      </div>
    </div>
  );
}
