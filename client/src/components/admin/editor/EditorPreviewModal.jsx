/**
 * EditorPreviewModal.jsx
 *
 * In-editor preview showing Header, Body and Footer as proper document sections.
 *
 * Features:
 *   1. HEADER renders with blue tint, shows section label + repeat badge
 *   2. BODY renders between header and footer, in the document content area
 *   3. FOOTER renders with grey tint, shows page number / doc date / doc info resolved
 *   4. Multi-page simulation: Body content auto-paginates into A4-height pages,
 *      with Header and Footer repeated on each page when repeatOnEveryPage is true
 *   5. Template placeholder substitution (same logic as pdfService.renderTemplate)
 *   6. Tabs: Preview | Sample Data | HTML Output (per-section)
 *
 * Props:
 *   open               boolean
 *   onClose            () => void
 *   editorData         { header, body, footer }
 *   layoutConfig       { pageSize, orientation, margins, background }
 *   templateName       string
 *   renderSectionHtml  (section) => string  — from TemplateEditorPage
 */

import { useState, useMemo, useRef, useEffect } from 'react';

// ── A4 dimensions for screen preview (px at 96dpi) ────────────────────────────
// 1 pt = 1.3333 px. A4 = 595.28 × 841.89 pt → 794 × 1122 px
const PAGE_W_PX = 595;
const PAGE_H_PX = 842;

// These match pdfService.resolveLayoutConfig's reserve amounts (converted pt→px)
// HEADER_RESERVE = 35pt = 47px   FOOTER_RESERVE = 55pt = 73px
const PDF_HEADER_RESERVE_PX = 47;
const PDF_FOOTER_RESERVE_PX = 73;

// ── Default sample data — mirrors server/controllers/templateController.js ────
// previewTemplatePdf sample data PLUS the new footer-specific fields.
const DEFAULT_SAMPLE = {
  // Employee
  'employee.full_name':    'Sara Ahmed (Preview)',
  'employee.position':     'HR Manager',
  'employee.department':   'Human Resources',
  'employee.email':        'sara@company.com',
  'employee.phone':        '+251 912 345 678',
  'employee.id':           'EMP-0042',
  'employee.join_date':    'January 1, 2022',
  // Finance
  'finance.salary':        'ETB 45,000',
  'finance.currency':      'ETB',
  'finance.pay_date':      'September 2, 2026',
  'finance.bank_name':     'Commercial Bank of Ethiopia',
  'finance.account_number':'1000123456789',
  // Student
  'student.full_name':     'Abebe Bekele (Preview)',
  'student.id':            'STU-2026-001',
  'student.program':       'Computer Science',
  'student.gpa':           '3.85',
  'student.year':          'Final Year',
  // Supplier
  'supplier.name':         'Addis Supplies PLC (Preview)',
  'supplier.tin':          'TIN-12345678',
  // Users datasource
  'employee_name':         'Sara Ahmed (Preview)',
  'employee_id':           'EMP-0042',
  'department':            'Human Resources',
  // Approver
  'approver.full_name':    'Dr. Tadesse Bekele',
  'approver.email':        'approver@company.com',
  'approver.role':         'Director',
  'approver.department':   'Administration',
  // System — note: logo/seal won't show in client preview (no server fetch)
  'system.company_name':   'DocuVault Organisation',
  'system.department':     'Document Management',
  'system.address':        '123 Bole Road, Addis Ababa',
  'system.contact_email':  'info@docuvault.com',
  'system.contact_phone':  '+251 111 234 567',
  'system.logo_url':       '',    // resolved server-side only
  'system.company_seal':   '',    // resolved server-side only
  // Dates — matches pdfService injectAutoPlaceholders output format
  'effective_date':        'September 2, 2026',
  'expiry_date':           'September 2, 2027',
  'issue_date':            'September 2, 2026',
  'generation_date':       'September 2, 2026',
  'generation_time':       '09:30 AM',
  'generation_datetime':   'September 2, 2026, 09:30 AM',
  'generation_year':       '2026',
  'generation_month':      'September',
  'generation_day':        '2',
  // Footer-specific — page_number / total_pages are resolved per-page (not here)
  // doc_id / ref_number / template_name resolved by pdfService Phase 1
  'doc_id':                'DOC-20260902-PREVIEW',
  'ref_number':            'REF-2026-001',
  'template_name':         'Template Name',
  // Arrays for repeat blocks
  'items':        [{ name: 'Item A', value: '1,000' }, { name: 'Item B', value: '2,000' }],
  'allowances':   [{ description: 'Housing Allowance', amount: 'ETB 5,000' }, { description: 'Transport', amount: 'ETB 2,000' }],
  'deductions':   [{ description: 'Income Tax', amount: 'ETB 4,500' }, { description: 'Pension', amount: 'ETB 900' }],
  'subjects':     [{ subject: 'Mathematics', grade: 'A', credit: '3' }, { subject: 'Programming', grade: 'A+', credit: '4' }],
  'rows':         [{ col1: 'Row 1 Col 1', col2: 'Row 1 Col 2' }, { col1: 'Row 2 Col 1', col2: 'Row 2 Col 2' }],
  'transactions': [{ date: 'Sept 1', description: 'Payment', amount: 'ETB 10,000' }],
};

// ── Client-side replica of pdfService.renderTemplate ─────────────────────────
// Must stay in sync with server/services/pdfService.js renderTemplate().
// NOTE: {{page_number}} and {{total_pages}} are intentionally left unresolved
// here — they are substituted per-page in PagePreview, mirroring pdfService's
// buildPageFooterFn which resolves them inside the pdfmake callback.
function renderTemplate(html, rawData) {
  if (!html) return '';
  const data = { ...rawData };
  let result = html;

  // Phase 3: loops — {{#each arrayKey}}...{{/each}}
  result = result.replace(
    /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, arrayKey, innerTemplate) => {
      const arr = data[arrayKey];
      if (!Array.isArray(arr) || arr.length === 0) return '';
      return arr.map(item => {
        let row = innerTemplate;
        if (typeof item === 'object') {
          for (const [k, v] of Object.entries(item)) {
            row = row.replace(new RegExp(`\\{\\{this\\.${k}\\}\\}`, 'g'), String(v ?? ''));
            row = row.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
          }
        } else {
          row = row.replace(/\{\{this\}\}/g, String(item ?? ''));
        }
        return row;
      }).join('');
    }
  );

  // Phase 2: conditionals — {{#if key}}...{{else}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, key, trueBranch, falseBranch = '') => {
      const val = data[key];
      const truthy = val !== undefined && val !== null && val !== '' && val !== false && val !== '0';
      return truthy ? trueBranch : falseBranch;
    }
  );

  // Phase 1: flat substitution — {{key}} (including dotted keys)
  // Skip page_number / total_pages — those are resolved per-page in PagePreview
  for (const [key, value] of Object.entries(data)) {
    if (key === 'page_number' || key === 'total_pages') continue;
    if (typeof value === 'string' || typeof value === 'number') {
      const escaped = key.replace(/\./g, '\\.').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
      result = result.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), String(value ?? ''));
    }
  }

  // Strip remaining unresolved (except page_number / total_pages which PagePreview handles)
  result = result.replace(
    /\{\{(?!page_number\}\}|total_pages\}\})[^}]+\}\}/g,
    '<span style="color:#f87171;font-size:0.85em;border:1px solid #fee2e2;border-radius:3px;padding:0 2px">[?]</span>'
  );

  return result;
}

// ── Single page preview component ─────────────────────────────────────────────
// Mirrors what pdfService.generatePDF produces:
//   - Page-level margins from layout_config (+ header/footer reserves)
//   - Rich header rendered above body content (buildPageHeaderFn equivalent)
//   - Custom footer above the always-present DocuVault security bar
//   - {{page_number}} / {{total_pages}} resolved per-page (buildPageFooterFn equivalent)
//   - Auto-footer bar: Doc ID + Verify URL + QR placeholder + page numbers
function PagePreview({ pageNumber, totalPages, headerHtml, bodyHtml, footerHtml,
                       headerSection, footerSection, sampleData, layoutConfig, templateName }) {

  // ── Margins: mirror resolveLayoutConfig() in pdfService ──────────────────
  // Convert pt → px (1pt = 1.3333px)
  const PT = 1.3333;
  const m  = layoutConfig?.margins || {};
  const mLeft   = Math.round((typeof m.left   === 'number' ? m.left   : 40) * PT);
  const mRight  = Math.round((typeof m.right  === 'number' ? m.right  : 40) * PT);
  const mTop    = Math.round((typeof m.top    === 'number' ? m.top    : 40) * PT);
  const mBottom = Math.round((typeof m.bottom === 'number' ? m.bottom : 40) * PT);
  // These reserves match pdfService exactly (35pt header, 55pt footer)
  const topReserve    = PDF_HEADER_RESERVE_PX;
  const bottomReserve = PDF_FOOTER_RESERVE_PX;

  const bg = layoutConfig?.background;
  const pageBg = bg?.type === 'color' ? (bg.color || '#ffffff') : '#ffffff';

  const headerEnabled = headerSection?.enabled !== false;
  const footerEnabled = footerSection?.enabled !== false;
  const headerRepeat  = headerSection?.repeatOnEveryPage !== false;
  const footerRepeat  = footerSection?.repeatOnEveryPage !== false;

  // Header: show on page 1 always; repeat on subsequent pages if configured
  const showHeader = headerEnabled && !!headerHtml && (pageNumber === 1 || headerRepeat);
  // Footer: show on page 1 always; repeat on subsequent pages if configured
  const showFooter = footerEnabled && !!footerHtml && (pageNumber === 1 || footerRepeat);

  // Resolve {{page_number}} / {{total_pages}} in the footer — same as pdfService's
  // buildPageFooterFn which does this inside the pdfmake footer callback.
  const resolvedFooterHtml = (footerHtml || '')
    .replace(/\{\{page_number\}\}/g, String(pageNumber))
    .replace(/\{\{total_pages\}\}/g, String(totalPages));

  // Render each section through the client-side template engine
  const renderedHeader = showHeader ? renderTemplate(headerHtml, sampleData) : '';
  const renderedBody   = renderTemplate(bodyHtml || '', sampleData);
  const renderedFooter = showFooter ? renderTemplate(resolvedFooterHtml, sampleData) : '';

  // Section border styles
  const hBorderB = headerSection?.borderBottom;
  const hBorderCss = (hBorderB?.show !== false && showHeader)
    ? `${hBorderB?.width || 1}px ${hBorderB?.style || 'solid'} ${hBorderB?.color || '#3b5bdb'}`
    : 'none';

  const fBorderT = footerSection?.borderTop;
  const fBorderCss = (fBorderT?.show !== false && showFooter)
    ? `${fBorderT?.width || 1}px ${fBorderT?.style || 'dashed'} ${fBorderT?.color || '#d1d5db'}`
    : 'none';

  const headerBg = headerSection?.background?.type === 'color'
    ? (headerSection.background.color || 'transparent') : 'transparent';
  const footerBg = footerSection?.background?.type === 'color'
    ? (footerSection.background.color || 'transparent') : 'transparent';

  return (
    <div style={{
      width: PAGE_W_PX,
      minHeight: PAGE_H_PX,
      background: pageBg,
      boxShadow: '0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
      borderRadius: 2,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Roboto, Arial, sans-serif',
    }}>

      {/* ── Page header bar (mirrors pdfService buildPageHeaderFn) ─────── */}
      {/* This is the REPEATING header — always shown (matches PDF behavior) */}
      <div style={{
        height: topReserve + mTop,
        flexShrink: 0,
        paddingLeft: mLeft,
        paddingRight: mRight,
        paddingTop: 8,
        boxSizing: 'border-box',
      }}>
        {renderedHeader ? (
          // Rich header content from editor (matches pdfService Task 3)
          <div
            className="preview-section preview-header"
            style={{
              background: headerBg,
              fontSize: 10, lineHeight: 1.5, color: '#333',
            }}
            dangerouslySetInnerHTML={{ __html: renderedHeader }}
          />
        ) : (
          // Fallback: legacy one-line template name + date bar
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f' }}>
              {templateName || 'Document'}
            </span>
            <span style={{ fontSize: 9, color: '#888888' }}>
              {sampleData['generation_date'] || 'September 2, 2026'}
            </span>
          </div>
        )}
        {/* Header bottom border (matches pdfService section border) */}
        {hBorderCss !== 'none' && (
          <div style={{ borderBottom: hBorderCss, marginTop: 6 }} />
        )}
        {showHeader && pageNumber > 1 && headerRepeat && (
          <div style={{ fontSize: 7, color: '#16a34a', marginTop: 2, opacity: 0.7 }}>
            ↻ Header repeating (page {pageNumber})
          </div>
        )}
      </div>

      {/* ── Body content ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        paddingLeft: mLeft,
        paddingRight: mRight,
        minHeight: 0,
        boxSizing: 'border-box',
      }}>
        <div
          className="preview-section preview-body"
          style={{ fontSize: 11, lineHeight: 1.6, color: '#333' }}
          dangerouslySetInnerHTML={{ __html: renderedBody || '<p style="color:#d1d5db;font-size:9pt;font-style:italic;">(no body content)</p>' }}
        />
      </div>

      {/* ── Custom footer (mirrors buildPageFooterFn top portion) ─────────── */}
      {showFooter && renderedFooter && (
        <div style={{
          flexShrink: 0,
          paddingLeft: mLeft,
          paddingRight: mRight,
          paddingTop: 4,
          boxSizing: 'border-box',
        }}>
          {fBorderCss !== 'none' && (
            <div style={{ borderTop: fBorderCss, marginBottom: 6 }} />
          )}
          {pageNumber > 1 && footerRepeat && (
            <div style={{ fontSize: 7, color: '#16a34a', marginBottom: 2, opacity: 0.7 }}>
              ↻ Footer repeating (page {pageNumber})
            </div>
          )}
          <div
            className="preview-section preview-footer"
            style={{
              background: footerBg,
              fontSize: 9, lineHeight: 1.5, color: '#6b7280',
            }}
            dangerouslySetInnerHTML={{ __html: renderedFooter }}
          />
        </div>
      )}

      {/* ── DocuVault auto-footer bar (ALWAYS present — mirrors pdfService) ── */}
      {/* This is the security footer: Doc ID + Verify URL + QR + page numbers */}
      {/* It is unconditional in pdfService.buildPageFooterFn */}
      <div style={{
        height: bottomReserve + mBottom,
        flexShrink: 0,
        paddingLeft: mLeft,
        paddingRight: mRight,
        paddingTop: 6,
        paddingBottom: 8,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        {/* Left: Doc ID + Verify URL + Page # */}
        <div style={{ flex: 1 }}>
          <div style={{
            borderTop: '0.5px solid #dddddd',
            marginBottom: 3,
          }} />
          <div style={{ fontSize: 7, color: '#555555', lineHeight: 1.5 }}>
            Doc ID: DOC-20260902-PREVIEW
          </div>
          <div style={{ fontSize: 7, color: '#3b5bdb', lineHeight: 1.5 }}>
            Verify: /verify/DOC-20260902-PREVIEW
          </div>
          <div style={{ fontSize: 7, color: '#888888', lineHeight: 1.5, marginTop: 1 }}>
            Page {pageNumber} of {totalPages}
          </div>
        </div>
        {/* Right: QR code placeholder */}
        <div style={{
          width: 48, height: 48, flexShrink: 0,
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 21 21" width="40" height="40">
            {[0,1,2,3,4,5,6].flatMap(r =>
              [0,1,2,3,4,5,6].map(c => {
                const finder = (r<3&&c<3)||(r<3&&c>3)||(r>3&&c<3)||
                  (r===1&&c===1)||(r===1&&c===5)||(r===5&&c===1);
                const fill = finder ? '#334155' : ((r+c)%2===0 ? '#334155' : 'transparent');
                return <rect key={`${r}-${c}`} x={c*3} y={r*3} width={2.5} height={2.5} fill={fill} />;
              })
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Sample data row ───────────────────────────────────────────────────────────
function SampleRow({ sampleKey, value, onChange }) {
  if (Array.isArray(value)) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 200, fontSize: 11, fontFamily: 'monospace', color: '#374151', paddingTop: 6, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sampleKey}
        </div>
        <div style={{ flex: 1, fontSize: 10, color: '#9ca3af', paddingTop: 6 }}>
          [{value.length} items — edit in JSON below]
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
      <div style={{ width: 200, fontSize: 10, fontFamily: 'monospace', color: '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sampleKey}
      </div>
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, padding: '3px 7px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 5, outline: 'none', color: '#374151' }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EditorPreviewModal({
  open,
  onClose,
  editorData,
  layoutConfig,
  templateName,
  renderSectionHtml,
}) {
  const [sampleData, setSampleData] = useState({ ...DEFAULT_SAMPLE });
  const [tab, setTab] = useState('preview');
  const [jsonError, setJsonError] = useState('');
  const [jsonText, setJsonText] = useState('');
  // How many simulated pages to show (1–5)
  const [simPages, setSimPages] = useState(1);

  // Build raw HTML strings per section
  const headerHtml = useMemo(() => renderSectionHtml ? renderSectionHtml(editorData?.header) : '', [editorData, renderSectionHtml]);
  const bodyHtml   = useMemo(() => renderSectionHtml ? renderSectionHtml(editorData?.body)   : '', [editorData, renderSectionHtml]);
  const footerHtml = useMemo(() => renderSectionHtml ? renderSectionHtml(editorData?.footer) : '', [editorData, renderSectionHtml]);

  const headerEnabled = editorData?.header?.enabled !== false;
  const footerEnabled = editorData?.footer?.enabled !== false;
  const headerRepeat  = editorData?.header?.repeatOnEveryPage !== false;
  const footerRepeat  = editorData?.footer?.repeatOnEveryPage !== false;

  const totalPages = simPages;

  const updateSampleField = (key, value) => setSampleData(prev => ({ ...prev, [key]: value }));

  const switchToDataJson = () => {
    const plainData = {};
    for (const [k, v] of Object.entries(sampleData)) {
      if (typeof v !== 'function') plainData[k] = v;
    }
    setJsonText(JSON.stringify(plainData, null, 2));
    setTab('data-json');
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setSampleData(parsed);
      setJsonError('');
      setTab('data');
    } catch (e) {
      setJsonError(e.message);
    }
  };

  if (!open) return null;

  const stringFields = Object.entries(sampleData).filter(([, v]) => typeof v !== 'object' || v === null);
  const arrayFields  = Object.entries(sampleData).filter(([, v]) => Array.isArray(v));

  // Build pages array
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.52)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '94vw', maxWidth: 1100, height: '92vh',
        background: '#f1f5f9',
        borderRadius: 14,
        boxShadow: '0 12px 60px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Modal header ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px',
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Template Preview</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
              {templateName || 'Untitled'} — rendered with sample data
            </div>
          </div>

          {/* Section status badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { name: 'Header', enabled: headerEnabled, repeat: headerRepeat, color: '#1d4ed8', bg: '#dbeafe' },
              { name: 'Body',   enabled: true,          repeat: false,         color: '#374151', bg: '#f3f4f6' },
              { name: 'Footer', enabled: footerEnabled, repeat: footerRepeat,  color: '#6b7280', bg: '#f3f4f6' },
            ].map(s => (
              <div key={s.name} style={{
                padding: '2px 8px', borderRadius: 5,
                background: s.enabled ? s.bg : '#fee2e2',
                border: `1px solid ${s.enabled ? s.color + '44' : '#fca5a5'}`,
                fontSize: 10, fontWeight: 600,
                color: s.enabled ? s.color : '#dc2626',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {s.name}
                {s.enabled ? (
                  s.repeat ? <span style={{ fontSize: 8 }}>↻</span> : <span style={{ fontSize: 8 }}>①</span>
                ) : (
                  <span style={{ fontSize: 8 }}>✕</span>
                )}
              </div>
            ))}
          </div>

          {/* Page simulation control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>Simulate pages:</span>
            {[1, 2, 3].map(n => (
              <button key={n} type="button"
                onClick={() => setSimPages(n)}
                style={{
                  width: 28, height: 24, borderRadius: 5, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${simPages === n ? '#2563eb' : '#d1d5db'}`,
                  background: simPages === n ? '#eff6ff' : '#fff',
                  color: simPages === n ? '#1d4ed8' : '#374151',
                  fontWeight: simPages === n ? 700 : 400,
                }}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'preview', label: '👁 Preview' },
              { id: 'data',    label: '🗂 Sample Data' },
              { id: 'html',    label: '</> HTML' },
            ].map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
                  border: `1px solid ${tab === t.id ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 7, background: tab === t.id ? '#eff6ff' : '#fff',
                  color: tab === t.id ? '#1d4ed8' : '#374151', cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
            ✕
          </button>
        </div>

        {/* ── Modal body ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

          {/* ── PREVIEW TAB ─────────────────────────────────────────────── */}
          {tab === 'preview' && (
            <div style={{
              flex: 1, overflow: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '28px 16px 48px',
              background: '#d1d5db',
              gap: 24,
            }}>
              {pages.map(pageNumber => {
                return (
                  <div key={pageNumber}>
                    {totalPages > 1 && (
                      <div style={{
                        textAlign: 'center', marginBottom: 6,
                        fontSize: 10, color: '#9ca3af', fontWeight: 500,
                      }}>
                        Page {pageNumber} of {totalPages}
                      </div>
                    )}
                    <PagePreview
                      pageNumber={pageNumber}
                      totalPages={totalPages}
                      headerHtml={headerHtml}
                      bodyHtml={bodyHtml}
                      footerHtml={footerHtml}
                      headerSection={editorData?.header}
                      footerSection={editorData?.footer}
                      sampleData={sampleData}
                      layoutConfig={layoutConfig}
                      templateName={templateName}
                    />
                  </div>
                );
              })}

              {/* Multi-page note */}
              {totalPages === 1 && (
                <div style={{
                  fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 4,
                }}>
                  Use "Simulate pages" above to see header/footer repeat across multiple pages
                </div>
              )}
            </div>
          )}

          {/* ── SAMPLE DATA TAB ─────────────────────────────────────────── */}
          {tab === 'data' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Sample Field Values</div>
                <button type="button" onClick={switchToDataJson}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}>
                  Edit as JSON
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
                Edit values to test how the template renders with different data. Logo and seal images won't appear in preview — they resolve server-side.
              </div>

              {stringFields.map(([key, val]) => (
                <SampleRow key={key} sampleKey={key} value={val ?? ''} onChange={v => updateSampleField(key, v)} />
              ))}

              {arrayFields.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginTop: 16, marginBottom: 8 }}>
                    Array Collections (for Repeat Blocks)
                  </div>
                  {arrayFields.map(([key, val]) => (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3, fontFamily: 'monospace' }}>
                        {key} [{Array.isArray(val) ? val.length : 0} items]
                      </div>
                      <textarea
                        value={JSON.stringify(val, null, 2)}
                        onChange={e => { try { updateSampleField(key, JSON.parse(e.target.value)); } catch { } }}
                        rows={4}
                        style={{ width: '100%', padding: '6px 8px', fontSize: 10, fontFamily: 'monospace', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── JSON DATA EDITOR TAB ─────────────────────────────────────── */}
          {tab === 'data-json' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Sample Data (JSON)</div>
              <textarea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                style={{ flex: 1, padding: '10px', fontSize: 11, fontFamily: 'monospace', border: '1px solid #d1d5db', borderRadius: 7, outline: 'none', resize: 'none' }}
              />
              {jsonError && <div style={{ color: '#dc2626', fontSize: 11 }}>JSON error: {jsonError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setTab('data')}
                  style={{ padding: '6px 14px', fontSize: 12, borderRadius: 7, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button type="button" onClick={applyJson}
                  style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none', background: '#2563eb', cursor: 'pointer', color: '#fff' }}>
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ── HTML OUTPUT TAB ──────────────────────────────────────────── */}
          {tab === 'html' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: '▲ HEADER HTML', html: headerHtml, enabled: headerEnabled, color: '#1d4ed8', bg: '#eff6ff', borderColor: '#bfdbfe' },
                { label: '▪ BODY HTML',   html: bodyHtml,   enabled: true,          color: '#374151', bg: '#f9fafb', borderColor: '#e5e7eb' },
                { label: '▼ FOOTER HTML', html: footerHtml, enabled: footerEnabled, color: '#6b7280', bg: '#f9fafb', borderColor: '#e5e7eb' },
              ].map(({ label, html, enabled, color, bg, borderColor }) => (
                <div key={label}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                    fontSize: 11, fontWeight: 700, color,
                  }}>
                    {label}
                    {!enabled && (
                      <span style={{ fontSize: 9, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                        DISABLED
                      </span>
                    )}
                    {!html && (
                      <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400, fontStyle: 'italic' }}>
                        (empty)
                      </span>
                    )}
                  </div>
                  <pre style={{
                    margin: 0, padding: '10px 12px',
                    background: '#0f172a', color: '#e2e8f0',
                    borderRadius: 8, fontSize: 10,
                    fontFamily: 'monospace', lineHeight: 1.7,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    maxHeight: 220, overflowY: 'auto',
                    border: `1px solid ${borderColor}`,
                  }}>
                    {html || '(no elements)'}
                  </pre>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Global preview styles */}
      <style>{`
        .preview-section p  { margin: 0 0 6px; }
        .preview-section h1 { font-size: 16pt; font-weight: 700; margin: 0 0 6px; color: #1e3a5f; }
        .preview-section h2 { font-size: 13pt; font-weight: 600; margin: 0 0 5px; color: #1e3a5f; }
        .preview-section h3 { font-size: 11pt; font-weight: 600; margin: 0 0 4px; color: #1e3a5f; }
        .preview-section table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
        .preview-section td, .preview-section th { border: 0.5px solid #dddddd; padding: 4px 6px; font-size: 9pt; }
        .preview-section th { background: #f0f4ff; font-weight: 700; }
        .preview-section hr { border: none; border-top: 0.5px solid #dddddd; margin: 6px 0; }
        .preview-section ul, .preview-section ol { margin: 0 0 6px; padding-left: 18px; }
        .preview-section li { margin-bottom: 2px; }
        .preview-section img { max-width: 100%; }
      `}</style>
    </div>
  );
}
