/**
 * ElementRenderer.jsx
 *
 * Renders a single canvas element based on its type.
 * Used inside DocumentCanvas for each element in header / body / footer.
 *
 * Inline editing behaviour:
 *   TEXT / HEADING       — single click → immediately enters inline edit mode
 *   WATERMARK (text)     — single click → inline edit of the watermark text
 *   DYNAMIC_FIELD        — single click → inline edit of the placeholder value
 *   All others           — single click selects, no inline editing
 *
 * Commit / cancel:
 *   Enter (no Shift)  → commit
 *   Escape            → cancel
 *   blur              → commit (with rAF delay so toolbar clicks fire first)
 */
import { useRef, useEffect, useCallback } from 'react';
import { ELEMENT_TYPES } from '../../../data/templateEditorModel';

// ── Typography helper ─────────────────────────────────────────────────────────
function typoStyle(t = {}) {
  return {
    fontFamily:      t.fontFamily    || 'Roboto, sans-serif',
    fontSize:        `${t.fontSize || 11}pt`,
    fontWeight:      t.bold      ? 700 : 400,
    fontStyle:       t.italic    ? 'italic' : 'normal',
    textDecoration:  [
      t.underline     ? 'underline'    : '',
      t.strikethrough ? 'line-through' : '',
    ].filter(Boolean).join(' ') || 'none',
    color:           t.color         || '#333333',
    backgroundColor: t.highlight     || 'transparent',
    textAlign:       t.align         || 'left',
    lineHeight:      t.lineHeight    || 1.5,
    letterSpacing:   t.letterSpacing ? `${t.letterSpacing}pt` : 'normal',
    wordBreak:       'break-word',
  };
}

// ── Inline text editor overlay ────────────────────────────────────────────────
// A <textarea> that sits exactly over the rendered element and lets the user type.
//
// Blur handling: we delay the commit by one rAF tick so that toolbar button
// clicks (which fire mousedown → focus-shift → blur → click) have already
// executed their onClick by the time we commit, avoiding a race condition.
function InlineTextEditor({ value, typography, placeholder, onCommit, onCancel, monospace }) {
  const ref       = useRef(null);
  const rafRef    = useRef(null);
  const committed = useRef(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.select();
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const doCommit = useCallback((val) => {
    if (committed.current) return;
    committed.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onCommit(val);
  }, [onCommit]);

  const doCancel = useCallback(() => {
    if (committed.current) return;
    committed.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onCancel();
  }, [onCancel]);

  const handleBlur = useCallback(() => {
    const currentVal = ref.current?.value ?? '';
    rafRef.current = requestAnimationFrame(() => doCommit(currentVal));
  }, [doCommit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      doCommit(ref.current?.value ?? '');
    }
    if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
    e.stopPropagation();
  }, [doCommit, doCancel]);

  const ts = typoStyle(typography || {});

  return (
    <textarea
      ref={ref}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position:    'absolute',
        inset:       0,
        width:       '100%',
        height:      '100%',
        boxSizing:   'border-box',
        padding:     '2px 4px',
        margin:      0,
        border:      '2px solid #2563eb',
        borderRadius: 2,
        outline:     'none',
        resize:      'none',
        overflow:    'auto',
        background:  'rgba(255,255,255,0.97)',
        zIndex:      100,
        cursor:      'text',
        fontFamily:      monospace ? 'monospace' : ts.fontFamily,
        fontSize:        ts.fontSize,
        fontWeight:      ts.fontWeight,
        fontStyle:       ts.fontStyle,
        textDecoration:  ts.textDecoration,
        color:           ts.color,
        textAlign:       ts.textAlign,
        lineHeight:      String(ts.lineHeight),
        letterSpacing:   ts.letterSpacing,
      }}
    />
  );
}

// ── Individual element renderers ──────────────────────────────────────────────

function TextEl({ el, isEditing, onCommitEdit, onCancelEdit }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{
        width: '100%', height: '100%',
        padding: '2px 4px',
        overflow: 'hidden',
        ...typoStyle(el.typography),
        opacity: isEditing ? 0.15 : 1,
        userSelect: isEditing ? 'none' : undefined,
      }}>
        {el.content || <span style={{ opacity: 0.35, fontStyle: 'italic' }}>Click to type…</span>}
      </div>
      {isEditing && (
        <InlineTextEditor
          value={el.content || ''}
          typography={el.typography}
          placeholder="Type here…"
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      )}
    </div>
  );
}

function HeadingEl({ el, isEditing, onCommitEdit, onCancelEdit }) {
  const Tag = `h${el.level || 1}`;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Tag style={{
        width: '100%', height: '100%',
        margin: 0, padding: '2px 4px',
        overflow: 'hidden',
        ...typoStyle(el.typography),
        opacity: isEditing ? 0.15 : 1,
      }}>
        {el.content || <span style={{ opacity: 0.35, fontStyle: 'italic' }}>Click to type…</span>}
      </Tag>
      {isEditing && (
        <InlineTextEditor
          value={el.content || ''}
          typography={el.typography}
          placeholder="Heading text…"
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      )}
    </div>
  );
}

function ImageEl({ el }) {
  return el.src ? (
    <img
      src={el.src}
      alt={el.alt || ''}
      style={{
        width: '100%', height: '100%',
        objectFit: el.objectFit || 'contain',
        borderRadius: el.borderRadius ? `${el.borderRadius}px` : 0,
        display: 'block', pointerEvents: 'none',
      }}
      draggable={false}
    />
  ) : (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f3f4f6', border: '1.5px dashed #9ca3af',
      borderRadius: el.borderRadius ? `${el.borderRadius}px` : 4,
      fontSize: '11pt', color: '#9ca3af', userSelect: 'none', gap: 6,
    }}>
      <span>🖼</span><span style={{ fontSize: '8pt' }}>Image</span>
    </div>
  );
}

function TableEl({ el }) {
  const s = el.style || {};
  return (
    <table style={{
      width: '100%', borderCollapse: 'collapse',
      fontSize: `${s.fontSize || 10}pt`,
      tableLayout: 'fixed',
    }}>
      <tbody>
        {(el.cells || []).map((row, ri) => (
          <tr key={ri} style={{ background: s.alternateRow && ri % 2 === 1 ? (s.alternateColor || '#f9f9f9') : 'transparent' }}>
            {(row || []).map((cell, ci) => {
              const isHeader = cell.isHeader;
              const CellTag  = isHeader ? 'th' : 'td';
              return (
                <CellTag
                  key={ci}
                  style={{
                    border: `${s.borderWidth || 0.5}px solid ${s.borderColor || '#dddddd'}`,
                    padding: '4px',
                    background: isHeader ? (s.headerBackground || '#f0f4ff') : 'transparent',
                    fontWeight: isHeader && s.headerBold ? 700 : 400,
                    textAlign: 'left',
                    fontSize: 'inherit',
                    verticalAlign: 'top',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}
                >
                  {cell.content || ''}
                </CellTag>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DividerEl({ el }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center',
    }}>
      <div style={{
        width: '100%',
        borderTop: `${el.lineWidth || 1}px ${el.lineStyle || 'solid'} ${el.color || '#dddddd'}`,
      }} />
    </div>
  );
}

function ShapeEl({ el }) {
  if (el.shapeType === 'line') {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: '100%',
          borderTop: `${el.strokeWidth || 1}px solid ${el.stroke || '#3b5bdb'}`,
        }} />
      </div>
    );
  }
  const isCircle = el.shapeType === 'circle';
  return (
    <div style={{
      width: '100%', height: '100%',
      background: el.fill || '#e0e7ff',
      border: `${el.strokeWidth || 1}px solid ${el.stroke || '#3b5bdb'}`,
      borderRadius: isCircle ? '50%' : (el.borderRadius ? `${el.borderRadius}px` : 0),
      boxSizing: 'border-box',
    }} />
  );
}

function DynamicFieldEl({ el, isEditing, onCommitEdit, onCancelEdit }) {
  const displayText = el.placeholder || '{{placeholder}}';
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center',
        padding: '2px 6px',
        background: isEditing ? 'rgba(239,246,255,0.4)' : '#eff6ff',
        border: '1.5px solid #93c5fd',
        borderRadius: 4,
        boxSizing: 'border-box',
        opacity: isEditing ? 0.2 : 1,
        overflow: 'hidden',
        gap: 4,
      }}>
        <span style={{ fontSize: '8pt', flexShrink: 0, opacity: 0.6 }}>{'{}'}</span>
        <span style={{
          ...typoStyle(el.typography),
          fontSize: `${el.typography?.fontSize || 11}pt`,
          color: '#1d4ed8',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
        }}>
          {displayText}
        </span>
      </div>
      {isEditing && (
        <InlineTextEditor
          value={el.placeholder || ''}
          typography={{ ...el.typography, color: '#1d4ed8' }}
          placeholder="{{table.column}}"
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
          monospace
        />
      )}
    </div>
  );
}

function ConditionalBlockEl({ el }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: el.editorColor || '#fff3cd',
      border: '1.5px dashed #f59e0b',
      borderRadius: 6, padding: '6px 8px',
      boxSizing: 'border-box', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontSize: '8pt', fontWeight: 700, color: '#92400e' }}>
        {'{{#if '}{el.condition || '…'}{'}}'}</div>
      {el.bodyHtml ? (
        <div style={{ fontSize: '7.5pt', color: '#78350f', borderLeft: '2px solid #f59e0b', paddingLeft: 4 }}
          dangerouslySetInnerHTML={{ __html: el.bodyHtml.slice(0, 120) }} />
      ) : (
        <div style={{ fontSize: '7.5pt', color: '#9ca3af', fontStyle: 'italic' }}>Configure in Properties panel</div>
      )}
      <div style={{ fontSize: '8pt', fontWeight: 700, color: '#92400e' }}>{'{{/if}}'}</div>
    </div>
  );
}

function RepeatBlockEl({ el }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: el.editorColor || '#d1fae5',
      border: '1.5px dashed #10b981',
      borderRadius: 6, padding: '6px 8px',
      boxSizing: 'border-box', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontSize: '8pt', fontWeight: 700, color: '#065f46' }}>
        {'{{#each '}{el.collection || '…'}{'}}'}</div>
      {el.rowHtml ? (
        <div style={{ fontSize: '7.5pt', color: '#047857', borderLeft: '2px solid #10b981', paddingLeft: 4 }}
          dangerouslySetInnerHTML={{ __html: el.rowHtml.slice(0, 120) }} />
      ) : (
        <div style={{ fontSize: '7.5pt', color: '#9ca3af', fontStyle: 'italic' }}>Configure in Properties panel</div>
      )}
      <div style={{ fontSize: '8pt', fontWeight: 700, color: '#065f46' }}>{'{{/each}}'}</div>
    </div>
  );
}

function SignatureEl({ el, type }) {
  const isUploaded = type === 'uploaded';
  const src = el.src || null;
  if (src) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, boxSizing: 'border-box', padding: 2 }}>
        <img src={src} alt={el.label || 'Signature'} style={{ maxWidth: '100%', maxHeight: el.showLabel !== false ? '80%' : '100%', objectFit: 'contain', display: 'block' }} draggable={false} />
        {el.showLabel !== false && el.labelText && (
          <div style={{ fontSize: '6.5pt', color: '#374151', borderTop: '1px solid #d1d5db', paddingTop: 2, width: '100%', textAlign: 'center', userSelect: 'none' }}>
            {el.labelText}
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isUploaded ? '#f0f9ff' : '#fdf4ff', border: `1.5px dashed ${isUploaded ? '#38bdf8' : '#c084fc'}`, borderRadius: 6, gap: 3, boxSizing: 'border-box', padding: 4 }}>
      <span style={{ fontSize: '14pt', userSelect: 'none' }}>{isUploaded ? '✍️' : '✒️'}</span>
      <span style={{ fontSize: '7.5pt', color: isUploaded ? '#0369a1' : '#7e22ce', fontWeight: 600, textAlign: 'center' }}>
        {isUploaded ? 'Upload Signature' : 'Draw Signature'}
      </span>
      <span style={{ fontSize: '7pt', color: '#9ca3af', textAlign: 'center' }}>Click to open editor</span>
    </div>
  );
}

function EsignPlaceholderEl({ el }) {
  const role = el.signerLabel || el.signerRole || 'Approver';
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', border: el.showBorder !== false ? '1.5px dashed #16a34a' : 'none', borderRadius: 6, gap: 3, boxSizing: 'border-box', padding: 4 }}>
      {el.showLabel !== false && <div style={{ fontSize: '7pt', color: '#374151', fontWeight: 600, textAlign: 'center' }}>{role}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80%', height: 28, border: '1px solid #16a34a', borderRadius: 4, background: '#dcfce7' }}>
        <span style={{ fontSize: '7pt', color: '#15803d', fontWeight: 700, letterSpacing: '0.04em' }}>E-SIGNATURE</span>
      </div>
      <div style={{ fontSize: '6.5pt', color: '#6b7280', textAlign: 'center' }}>Applied at approval</div>
    </div>
  );
}

function CompanySealEl({ el }) {
  const imgSrc = el.src || null;
  if (imgSrc) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
        <img src={imgSrc} alt={el.label || 'Company Seal'} style={{ maxWidth: '100%', maxHeight: el.showLabel ? '80%' : '100%', objectFit: el.objectFit || 'contain', display: 'block', borderRadius: el.circular !== false ? '50%' : 0 }} draggable={false} />
        {el.showLabel && <div style={{ fontSize: '6.5pt', color: '#374151', marginTop: 2, textAlign: 'center', userSelect: 'none' }}>{el.label || 'Official Seal'}</div>}
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#faf5ff', border: '1.5px dashed #7c3aed', borderRadius: el.circular !== false ? '50%' : 6, gap: 3, boxSizing: 'border-box' }}>
      <span style={{ fontSize: '16pt', userSelect: 'none' }}>◉</span>
      <span style={{ fontSize: '7pt', color: '#7c3aed', fontWeight: 600, textAlign: 'center', padding: '0 4px' }}>Company Seal</span>
      <span style={{ fontSize: '6.5pt', color: '#9ca3af', textAlign: 'center' }}>Uses &#123;&#123;system.company_seal&#125;&#125;</span>
    </div>
  );
}

function StampEl({ el }) {
  const text       = el.stampText  || 'APPROVED';
  const shape      = el.stampShape || 'circle';
  const stroke     = el.stroke     || '#dc2626';
  const strokeWidth = el.strokeWidth || 3;
  const t          = el.typography || {};

  const borderRadius = shape === 'circle'    ? '50%'
                     : shape === 'diamond'   ? '4px'
                     : '8px';

  const transform = shape === 'diamond' ? 'rotate(45deg)' : undefined;

  return (
    <div style={{
      width:  '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      {/* Stamp border */}
      <div style={{
        position: 'absolute',
        inset: strokeWidth,
        border: `${strokeWidth}px solid ${stroke}`,
        borderRadius,
        transform,
        boxSizing: 'border-box',
        opacity: 0.9,
      }} />
      {/* Inner double-border effect */}
      <div style={{
        position: 'absolute',
        inset: strokeWidth * 2 + 2,
        border: `1px solid ${stroke}`,
        borderRadius,
        transform,
        boxSizing: 'border-box',
        opacity: 0.5,
      }} />
      {/* Stamp text */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        padding: '0 8px',
        ...typoStyle(t),
        color: stroke,
        fontSize: `${t.fontSize || 14}pt`,
        letterSpacing: '0.08em',
        fontWeight: t.bold !== false ? 700 : 400,
        userSelect: 'none',
        lineHeight: 1.2,
      }}>
        {text}
      </div>
    </div>
  );
}

function QrCodeEl() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }}>
      <svg viewBox="0 0 21 21" width="80%" height="80%" style={{ display: 'block' }}>
        {[...Array(7)].map((_, r) =>
          [...Array(7)].map((_, c) => {
            const finder = (r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3) || (r === 1 && c === 1) || (r === 1 && c === 5) || (r === 5 && c === 1);
            return <rect key={`${r}-${c}`} x={c * 3} y={r * 3} width={2.5} height={2.5} fill={finder ? '#334155' : (Math.random() > 0.5 ? '#334155' : 'transparent')} />;
          })
        )}
      </svg>
    </div>
  );
}

// WatermarkEl supports inline editing for the text label
function WatermarkEl({ el, isEditing, onCommitEdit, onCancelEdit }) {
  const isImageMode = el.watermarkMode === 'image';
  const layerLabel  = el.layer === 'infront' ? 'FRONT' : 'BEHIND';
  const layerColor  = el.layer === 'infront' ? '#ef4444' : '#6366f1';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
      {/* Visual content */}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: isEditing ? 0.15 : 1 }}>
        {isImageMode ? (
          el.imageUrl ? (
            <img src={el.imageUrl} alt="Watermark" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: el.objectFit || 'contain', display: 'block' }} draggable={false} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, border: '1.5px dashed #f59e0b', borderRadius: 6, padding: '12px 20px', background: 'rgba(254,243,199,0.6)' }}>
              <span style={{ fontSize: '18pt' }}>🖼️</span>
              <span style={{ fontSize: '8pt', color: '#b45309', fontWeight: 600 }}>Image Watermark</span>
            </div>
          )
        ) : (
          <span style={{ ...typoStyle(el.typography), whiteSpace: 'nowrap', overflow: 'visible', maxWidth: 'none', textAlign: 'center', display: 'block', width: '100%', userSelect: 'none' }}>
            {el.text || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Click to edit text…</span>}
          </span>
        )}
      </div>

      {/* Inline text editor — only for text mode */}
      {isEditing && !isImageMode && (
        <InlineTextEditor
          value={el.text || ''}
          typography={el.typography}
          placeholder="CONFIDENTIAL"
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      )}

      {/* Layer badge */}
      <div style={{ position: 'absolute', top: 2, right: 2, background: layerColor, color: '#fff', fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 3, letterSpacing: '0.05em', lineHeight: 1.4, opacity: 0.85, pointerEvents: 'none' }}>
        {layerLabel}
      </div>
    </div>
  );
}

function LogoEl({ el }) {
  const src = el.sourceType === 'custom' ? el.src : (el.src || null);
  if (src) {
    return <img src={src} alt={el.alt || 'Company Logo'} style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'contain', borderRadius: el.borderRadius ? `${el.borderRadius}px` : 0, display: 'block', pointerEvents: 'none' }} draggable={false} />;
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1.5px dashed #93c5fd', borderRadius: el.borderRadius ? `${el.borderRadius}px` : 6, gap: 3, boxSizing: 'border-box' }}>
      <span style={{ fontSize: '16pt', userSelect: 'none' }}>🏢</span>
      <span style={{ fontSize: '7.5pt', color: '#1d4ed8', fontWeight: 700, textAlign: 'center', padding: '0 4px' }}>Company Logo</span>
      <span style={{ fontSize: '6.5pt', color: '#93c5fd', textAlign: 'center' }}>&#123;&#123;system.logo_url&#125;&#125;</span>
    </div>
  );
}

function PageNumberEl({ el }) {
  const formatLabels = { page_of_total: 'Page 1 of 3', page_only: 'Page 1', custom: el.customText || 'Page {{page_number}} of {{total_pages}}' };
  const preview = formatLabels[el.format || 'page_of_total'] || 'Page 1 of 3';
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '2px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, boxSizing: 'border-box', gap: 4 }}>
      <span style={{ fontSize: '8pt', userSelect: 'none', opacity: 0.5 }}>📄</span>
      <span style={{ ...typoStyle(el.typography), fontSize: `${el.typography?.fontSize || 9}pt`, color: el.typography?.color || '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
        {preview}
      </span>
    </div>
  );
}

function DocDateEl({ el }) {
  const fieldLabels = { generation_date: 'September 2, 2026', issue_date: 'September 2, 2026', effective_date: 'September 2, 2026', custom: `{{${el.customField || 'date'}}}` };
  const preview = `${el.prefix || ''}${fieldLabels[el.dateField || 'generation_date'] || 'September 2, 2026'}`;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '2px 6px', background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 4, boxSizing: 'border-box', gap: 4 }}>
      <span style={{ fontSize: '8pt', userSelect: 'none', opacity: 0.5 }}>📅</span>
      <span style={{ ...typoStyle(el.typography), fontSize: `${el.typography?.fontSize || 9}pt`, color: el.typography?.color || '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
        {preview}
      </span>
    </div>
  );
}

function DocInfoEl({ el }) {
  const infoLabels = { doc_id: 'DOC-2026-0042', ref_number: 'REF-2026-001', template_name: 'Template Name', custom: `{{${el.customField || 'doc_id'}}}` };
  const preview = `${el.prefix !== undefined ? el.prefix : 'Ref: '}${infoLabels[el.infoType || 'doc_id'] || 'DOC-2026-0042'}`;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '2px 6px', background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 4, boxSizing: 'border-box', gap: 4 }}>
      <span style={{ fontSize: '8pt', userSelect: 'none', opacity: 0.5 }}>🔖</span>
      <span style={{ ...typoStyle(el.typography), fontSize: `${el.typography?.fontSize || 9}pt`, color: el.typography?.color || '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
        {preview}
      </span>
    </div>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────
// `editingId`    — the id of the element currently being inline-edited (or null)
// `onCommitEdit` — (newValue) => void  — called when inline edit is committed
// `onCancelEdit` — () => void          — called when inline edit is cancelled
export default function ElementRenderer({ el, isSelected, editingId, onCommitEdit, onCancelEdit }) {
  const isEditing = editingId === el.id;
  const editProps = { isEditing, onCommitEdit, onCancelEdit };

  switch (el.type) {
    case ELEMENT_TYPES.TEXT:               return <TextEl             el={el} isSelected={isSelected} {...editProps} />;
    case ELEMENT_TYPES.HEADING:            return <HeadingEl          el={el} {...editProps} />;
    case ELEMENT_TYPES.IMAGE:              return <ImageEl            el={el} />;
    case ELEMENT_TYPES.LOGO:               return <LogoEl             el={el} />;
    case ELEMENT_TYPES.TABLE:              return <TableEl            el={el} />;
    case ELEMENT_TYPES.DIVIDER:            return <DividerEl          el={el} />;
    case ELEMENT_TYPES.SHAPE:              return <ShapeEl            el={el} />;
    case ELEMENT_TYPES.DYNAMIC_FIELD:      return <DynamicFieldEl     el={el} {...editProps} />;
    case ELEMENT_TYPES.CONDITIONAL_BLOCK:  return <ConditionalBlockEl el={el} />;
    case ELEMENT_TYPES.REPEAT_BLOCK:       return <RepeatBlockEl      el={el} />;
    case ELEMENT_TYPES.SIGNATURE_UPLOADED: return <SignatureEl        el={el} type="uploaded" />;
    case ELEMENT_TYPES.SIGNATURE_DRAWN:    return <SignatureEl        el={el} type="drawn" />;
    case ELEMENT_TYPES.ESIGN_PLACEHOLDER:  return <EsignPlaceholderEl el={el} />;
    case ELEMENT_TYPES.COMPANY_SEAL:       return <CompanySealEl      el={el} />;
    case ELEMENT_TYPES.STAMP:              return <StampEl            el={el} />;
    case ELEMENT_TYPES.QR_CODE:            return <QrCodeEl />;
    case ELEMENT_TYPES.WATERMARK:          return <WatermarkEl        el={el} {...editProps} />;
    case ELEMENT_TYPES.PAGE_NUMBER:        return <PageNumberEl       el={el} />;
    case ELEMENT_TYPES.DOC_DATE:           return <DocDateEl          el={el} />;
    case ELEMENT_TYPES.DOC_INFO:           return <DocInfoEl          el={el} />;
    default:
      return (
        <div style={{ width: '100%', height: '100%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9pt', color: '#9ca3af' }}>
          {el.type}
        </div>
      );
  }
}
