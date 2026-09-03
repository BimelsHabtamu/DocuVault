/**
 * TemplateEditorPage.jsx
 *
 * Professional document template editor for DocuVault Admin.
 * Handles both Create (/templates/new) and Edit (/templates/:id/edit).
 *
 * Architecture:
 *   - Top bar      — template metadata + Save Draft / Preview / Publish actions
 *   - Left panel   — Insert palette (15 element types, drag-to-canvas)
 *   - Centre       — DocumentCanvas (A4 page with header/body/footer sections)
 *   - Right panel  — Properties inspector (selected element + document settings)
 *   - Toolbar      — Rich formatting toolbar above canvas
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams }   from 'react-router-dom';
import { useToast }                 from '../context/ToastContext';
import axiosInstance                from '../api/axiosInstance';
import DocumentCanvas               from '../components/admin/editor/DocumentCanvas';
import InsertFieldPanel             from '../components/admin/editor/InsertFieldPanel';
import ConditionalBlockEditor       from '../components/admin/editor/ConditionalBlockEditor';
import RepeatBlockEditor            from '../components/admin/editor/RepeatBlockEditor';
import EditorPreviewModal           from '../components/admin/editor/EditorPreviewModal';
import SignatureUploadModal         from '../components/admin/editor/SignatureUploadModal';
import SignatureDrawModal           from '../components/admin/editor/SignatureDrawModal';
import TemplateVersionHistoryPanel  from '../components/admin/editor/TemplateVersionHistoryPanel';

import {
  ELEMENT_TYPES, ELEMENT_LABELS, PAGE_SIZES,
  SECTION_ALLOWED_TYPES, isTypeAllowedInSection,
  createElement, defaultLayoutConfig, defaultEditorData,
  hydrateTemplate, serializeEditorData, generateId,
} from '../data/templateEditorModel';

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];

const FONT_FAMILIES = [
  'Roboto', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS',
  'NotoSansEthiopic', 'NotoNaskhArabic',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

// Insert panel groups — ALL element types across all three sections.
// The left panel shows all types; section restriction is enforced on drop/click.
const INSERT_GROUPS = [
  {
    label: 'Header',
    section: 'header',
    color: '#eff6ff',
    borderColor: '#bfdbfe',
    items: [
      { type: ELEMENT_TYPES.LOGO,          icon: '🏢', label: 'Logo' },
      { type: ELEMENT_TYPES.TEXT,          icon: '¶',  label: 'Text' },
      { type: ELEMENT_TYPES.HEADING,       icon: 'H',  label: 'Heading' },
      { type: ELEMENT_TYPES.IMAGE,         icon: '⬜', label: 'Image' },
      { type: ELEMENT_TYPES.DYNAMIC_FIELD, icon: '{}', label: 'Field' },
      { type: ELEMENT_TYPES.SHAPE,         icon: '◻',  label: 'Shape' },
      { type: ELEMENT_TYPES.DIVIDER,       icon: '—',  label: 'Divider' },
      { type: ELEMENT_TYPES.COMPANY_SEAL,  icon: '◉',  label: 'Seal' },
      { type: ELEMENT_TYPES.STAMP,         icon: '🔴', label: 'Stamp' },
      { type: ELEMENT_TYPES.WATERMARK,     icon: '≋',  label: 'Watermark' },
    ],
  },
  {
    label: 'Body',
    section: 'body',
    color: '#f9fafb',
    borderColor: '#e5e7eb',
    items: [
      { type: ELEMENT_TYPES.TEXT,               icon: '¶',  label: 'Text' },
      { type: ELEMENT_TYPES.HEADING,            icon: 'H',  label: 'Heading' },
      { type: ELEMENT_TYPES.IMAGE,              icon: '⬜', label: 'Image' },
      { type: ELEMENT_TYPES.TABLE,              icon: '⊞',  label: 'Table' },
      { type: ELEMENT_TYPES.DIVIDER,            icon: '—',  label: 'Divider' },
      { type: ELEMENT_TYPES.SHAPE,              icon: '◻',  label: 'Shape' },
      { type: ELEMENT_TYPES.DYNAMIC_FIELD,      icon: '{}', label: 'Field' },
      { type: ELEMENT_TYPES.CONDITIONAL_BLOCK,  icon: '?',  label: 'If/Else' },
      { type: ELEMENT_TYPES.REPEAT_BLOCK,       icon: '↺',  label: 'Repeat' },
      { type: ELEMENT_TYPES.SIGNATURE_UPLOADED, icon: '✍',  label: 'Upload Sig' },
      { type: ELEMENT_TYPES.SIGNATURE_DRAWN,    icon: '✒',  label: 'Draw Sig' },
      { type: ELEMENT_TYPES.ESIGN_PLACEHOLDER,  icon: '✔',  label: 'E-Sign' },
      { type: ELEMENT_TYPES.COMPANY_SEAL,       icon: '◉',  label: 'Seal' },
      { type: ELEMENT_TYPES.STAMP,              icon: '🔴', label: 'Stamp' },
      { type: ELEMENT_TYPES.QR_CODE,            icon: '▦',  label: 'QR Code' },
      { type: ELEMENT_TYPES.WATERMARK,          icon: '≋',  label: 'Watermark' },
    ],
  },
  {
    label: 'Footer',
    section: 'footer',
    color: '#f9fafb',
    borderColor: '#e5e7eb',
    items: [
      { type: ELEMENT_TYPES.TEXT,          icon: '¶',  label: 'Text' },
      { type: ELEMENT_TYPES.PAGE_NUMBER,   icon: '📄', label: 'Page №' },
      { type: ELEMENT_TYPES.DOC_DATE,      icon: '📅', label: 'Doc Date' },
      { type: ELEMENT_TYPES.DOC_INFO,      icon: '🔖', label: 'Doc Info' },
      { type: ELEMENT_TYPES.QR_CODE,       icon: '▦',  label: 'QR Code' },
      { type: ELEMENT_TYPES.DYNAMIC_FIELD, icon: '{}', label: 'Field' },
      { type: ELEMENT_TYPES.IMAGE,         icon: '⬜', label: 'Image' },
      { type: ELEMENT_TYPES.DIVIDER,       icon: '—',  label: 'Divider' },
      { type: ELEMENT_TYPES.SHAPE,         icon: '◻',  label: 'Shape' },
      { type: ELEMENT_TYPES.COMPANY_SEAL,  icon: '◉',  label: 'Seal' },
      { type: ELEMENT_TYPES.STAMP,         icon: '🔴', label: 'Stamp' },
    ],
  },
];

// ── Small reusable UI atoms ───────────────────────────────────────────────────

function TbBtn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 28, height: 28,
        padding: '0 4px',
        background: active ? '#eff6ff' : 'transparent',
        border: active ? '1px solid #bfdbfe' : '1px solid transparent',
        borderRadius: 5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#d1d5db' : active ? '#1d4ed8' : '#374151',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseEnter={e => { if (!disabled && !active) e.currentTarget.style.background = '#f3f4f6'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function TbDivider() {
  return <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px', flexShrink: 0 }} />;
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', style }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '6px 8px',
        fontSize: 12, border: '1px solid #d1d5db',
        borderRadius: 6, outline: 'none', boxSizing: 'border-box',
        ...style,
      }}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '6px 8px',
        fontSize: 12, border: '1px solid #d1d5db',
        borderRadius: 6, outline: 'none',
        background: '#ffffff',
      }}
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

// ── Section Settings Panel ────────────────────────────────────────────────────
// Shown in the Properties panel when a section bar is clicked (no element selected)
function SectionSettingsPanel({ sectionName, section, onUpdateSection }) {
  if (!section || !sectionName) return null;

  const SECTION_COLORS = {
    header: { accent: '#1d4ed8', bg: '#eff6ff' },
    body:   { accent: '#374151', bg: '#f9fafb' },
    footer: { accent: '#6b7280', bg: '#f3f4f6' },
  };
  const colors = SECTION_COLORS[sectionName] || SECTION_COLORS.body;
  const isBody    = sectionName === 'body';
  const enabled   = section.enabled !== false;
  const repeatEvery = section.repeatOnEveryPage !== false;
  const borderKey = sectionName === 'header' ? 'borderBottom' : 'borderTop';
  const border    = section[borderKey] || { show: true, style: 'solid', width: 1, color: '#3b5bdb' };

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto' }}>
      {/* Section title */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 14, paddingBottom: 10,
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: colors.bg, border: `1.5px solid ${colors.accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: colors.accent,
          flexShrink: 0, textTransform: 'uppercase',
        }}>
          {sectionName[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {sectionName} Section
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
            {sectionName === 'header' && 'Appears at the top of every page'}
            {sectionName === 'body'   && 'Main content — flows across pages'}
            {sectionName === 'footer' && 'Appears at the bottom of every page'}
          </div>
        </div>
      </div>

      {/* Enable/Disable */}
      <FieldRow label="Section Enabled">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <div
            onClick={() => onUpdateSection(sectionName, { enabled: !enabled })}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: enabled ? colors.accent : '#d1d5db',
              position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: enabled ? 17 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.15s',
            }} />
          </div>
          <span style={{ color: enabled ? '#111827' : '#9ca3af' }}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </FieldRow>

      {/* Repeat on every page (header/footer only) */}
      {!isBody && (
        <FieldRow label="Repeat on Every Page">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
            <div
              onClick={() => onUpdateSection(sectionName, { repeatOnEveryPage: !repeatEvery })}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: repeatEvery ? '#16a34a' : '#d1d5db',
                position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 2,
                left: repeatEvery ? 17 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left 0.15s',
              }} />
            </div>
            <span style={{ color: repeatEvery ? '#15803d' : '#9ca3af', fontSize: 11 }}>
              {repeatEvery ? 'Repeats on all pages' : 'First page only'}
            </span>
          </label>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
            Controls PDF header/footer repetition
          </div>
        </FieldRow>
      )}

      {/* Section height */}
      <FieldRow label="Height (pt)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="range"
            min={sectionName === 'body' ? 100 : 30}
            max={sectionName === 'body' ? 2000 : 300}
            step={5}
            value={section.height || (sectionName === 'header' ? 80 : sectionName === 'footer' ? 60 : 500)}
            onChange={e => onUpdateSection(sectionName, { height: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={sectionName === 'body' ? 100 : 30}
            max={sectionName === 'body' ? 2000 : 300}
            value={section.height || (sectionName === 'header' ? 80 : sectionName === 'footer' ? 60 : 500)}
            onChange={e => onUpdateSection(sectionName, { height: Number(e.target.value) })}
            style={{ width: 60, padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
          />
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
          Drag the resize handle on the canvas or enter a value
        </div>
      </FieldRow>

      {/* Background */}
      <FieldRow label="Background">
        <Select
          value={section.background?.type || 'none'}
          onChange={v => onUpdateSection(sectionName, { background: { ...section.background, type: v } })}
          options={[
            { value: 'none',  label: 'None (transparent)' },
            { value: 'color', label: 'Solid Color' },
          ]}
        />
        {section.background?.type === 'color' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input
              type="color"
              value={section.background?.color || '#ffffff'}
              onChange={e => onUpdateSection(sectionName, { background: { ...section.background, color: e.target.value } })}
              style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
            />
            <Input
              value={section.background?.color || '#ffffff'}
              onChange={v => onUpdateSection(sectionName, { background: { ...section.background, color: v } })}
              placeholder="#ffffff"
            />
          </div>
        )}
      </FieldRow>

      {/* Border (header: bottom border / footer: top border) */}
      {sectionName !== 'body' && (
        <FieldRow label={sectionName === 'header' ? 'Bottom Border' : 'Top Border'}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={border.show !== false}
              onChange={e => onUpdateSection(sectionName, { [borderKey]: { ...border, show: e.target.checked } })}
            />
            Show border
          </label>
          {border.show !== false && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Style</div>
                  <Select
                    value={border.style || 'solid'}
                    onChange={v => onUpdateSection(sectionName, { [borderKey]: { ...border, style: v } })}
                    options={['solid', 'dashed', 'dotted']}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Width (px)</div>
                  <input
                    type="number" min={0.5} max={8} step={0.5}
                    value={border.width || 1}
                    onChange={e => onUpdateSection(sectionName, { [borderKey]: { ...border, width: Number(e.target.value) } })}
                    style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={border.color || '#3b5bdb'}
                  onChange={e => onUpdateSection(sectionName, { [borderKey]: { ...border, color: e.target.value } })}
                  style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
                />
                <Input
                  value={border.color || '#3b5bdb'}
                  onChange={v => onUpdateSection(sectionName, { [borderKey]: { ...border, color: v } })}
                  placeholder="#3b5bdb"
                />
              </div>
            </>
          )}
        </FieldRow>
      )}

      {/* Hint box */}
      <div style={{
        fontSize: 10, color: '#6b7280',
        padding: '8px 10px', marginTop: 6,
        background: colors.bg,
        borderRadius: 6, border: `1px solid ${colors.accent}33`,
        lineHeight: 1.5,
      }}>
        {sectionName === 'header' && (
          <>
            <strong>Header elements allowed:</strong> Logo, Company Name (Text/Field), Title, Text, Images, Shapes, Seal, Watermark.<br />
            Drag elements from the <em>Header</em> section in the Insert panel.
          </>
        )}
        {sectionName === 'body' && (
          <>
            <strong>Body elements allowed:</strong> All content types — Text, Headings, Tables, Dynamic Fields, Conditional/Repeat Blocks, Signatures, Seal, Watermark.<br />
            Body flows across pages when content overflows.
          </>
        )}
        {sectionName === 'footer' && (
          <>
            <strong>Footer elements allowed:</strong> Text, Dynamic Fields, Page Number, Document Date, Document Info (ID/Ref), QR Code, Images.<br />
            Drag elements from the <em>Footer</em> section in the Insert panel.
          </>
        )}
      </div>
    </div>
  );
}

// ── Properties Panel ──────────────────────────────────────────────────────────
function PropertiesPanel({ el, section, sectionData, onUpdate, onUpdateSection, layoutConfig, onUpdateLayout, schema, onOpenFieldPanel, onOpenSigUpload, onOpenSigDraw }) {
  // ── Section selected (no element) → show section settings ──────────────
  if (!el && section && sectionData) {
    return <SectionSettingsPanel sectionName={section} section={sectionData} onUpdateSection={onUpdateSection} />;
  }

  if (!el) {
    // Document settings
    return (
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Document Settings
        </div>

        <FieldRow label="Page Size">
          <Select
            value={layoutConfig.pageSize}
            onChange={v => onUpdateLayout({ pageSize: v })}
            options={[{ value: 'A4', label: 'A4 (210 × 297mm)' }, { value: 'LETTER', label: 'Letter (8.5 × 11in)' }]}
          />
        </FieldRow>

        <FieldRow label="Orientation">
          <div style={{ display: 'flex', gap: 6 }}>
            {['portrait', 'landscape'].map(o => (
              <button
                key={o}
                type="button"
                onClick={() => onUpdateLayout({ orientation: o })}
                style={{
                  flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6,
                  border: `1px solid ${layoutConfig.orientation === o ? '#3b82f6' : '#d1d5db'}`,
                  background: layoutConfig.orientation === o ? '#eff6ff' : '#fff',
                  color: layoutConfig.orientation === o ? '#1d4ed8' : '#374151',
                  cursor: 'pointer', fontWeight: layoutConfig.orientation === o ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Margins (pt)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {['top', 'right', 'bottom', 'left'].map(side => (
              <div key={side}>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, textTransform: 'capitalize' }}>{side}</div>
                <input
                  type="number" min={0} max={200}
                  value={layoutConfig.margins?.[side] ?? 40}
                  onChange={e => onUpdateLayout({ margins: { ...layoutConfig.margins, [side]: Number(e.target.value) } })}
                  style={{
                    width: '100%', padding: '4px 6px', fontSize: 12,
                    border: '1px solid #d1d5db', borderRadius: 5, outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Background">
          <Select
            value={layoutConfig.background?.type || 'none'}
            onChange={v => onUpdateLayout({ background: { ...layoutConfig.background, type: v } })}
            options={[
              { value: 'none',  label: 'None (white)' },
              { value: 'color', label: 'Solid Color' },
            ]}
          />
          {layoutConfig.background?.type === 'color' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input
                type="color"
                value={layoutConfig.background?.color || '#ffffff'}
                onChange={e => onUpdateLayout({ background: { ...layoutConfig.background, color: e.target.value } })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
              />
              <Input
                value={layoutConfig.background?.color || '#ffffff'}
                onChange={v => onUpdateLayout({ background: { ...layoutConfig.background, color: v } })}
                placeholder="#ffffff"
                style={{ flex: 1 }}
              />
            </div>
          )}
        </FieldRow>
      </div>
    );
  }

  // Element properties
  const t = el.typography || {};
  const updateTypo = (patch) => onUpdate({ typography: { ...t, ...patch } });

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {ELEMENT_LABELS[el.type] || el.type}
      </div>

      {/* Position & Size */}
      <FieldRow label="Position & Size">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {[['X', 'x'], ['Y', 'y'], ['W', 'width'], ['H', 'height']].map(([lbl, key]) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>{lbl} (pt)</div>
              <input
                type="number"
                value={Math.round(el[key] ?? 0)}
                onChange={e => onUpdate({ [key]: Number(e.target.value) })}
                style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
              />
            </div>
          ))}
        </div>
      </FieldRow>

      {/* Transform */}
      <FieldRow label="Transform">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>Rotation (°)</div>
            <input
              type="number" min={-180} max={180}
              value={el.rotation ?? 0}
              onChange={e => onUpdate({ rotation: Number(e.target.value) })}
              style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>Opacity</div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={el.opacity ?? 1}
              onChange={e => onUpdate({ opacity: Number(e.target.value) })}
              style={{ width: '100%', marginTop: 6 }}
            />
          </div>
        </div>
      </FieldRow>

      {/* Layer */}
      <FieldRow label="Layer (z-index)">
        <input
          type="number" min={0} max={999}
          value={el.zIndex ?? 0}
          onChange={e => onUpdate({ zIndex: Number(e.target.value) })}
          style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
        />
      </FieldRow>

      {/* Visibility */}
      <FieldRow label="Visibility">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={el.visible !== false}
            onChange={e => onUpdate({ visible: e.target.checked })}
          />
          Visible on page
        </label>
      </FieldRow>

      {/* ── Type-specific properties ── */}

      {/* Text / Heading / Dynamic Field typography */}
      {[ELEMENT_TYPES.TEXT, ELEMENT_TYPES.HEADING, ELEMENT_TYPES.DYNAMIC_FIELD].includes(el.type) && (
        <>
          <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Typography</div>

            <FieldRow label="Font Family">
              <Select
                value={t.fontFamily || 'Roboto'}
                onChange={v => updateTypo({ fontFamily: v })}
                options={FONT_FAMILIES}
              />
            </FieldRow>

            <FieldRow label="Font Size (pt)">
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  type="number" min={6} max={200}
                  value={t.fontSize || 11}
                  onChange={e => updateTypo({ fontSize: Number(e.target.value) })}
                  style={{ width: 70, padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {[8,10,11,12,14,16,18,24,36].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateTypo({ fontSize: s })}
                      style={{
                        padding: '2px 5px', fontSize: 10, borderRadius: 4,
                        border: '1px solid #d1d5db',
                        background: t.fontSize === s ? '#eff6ff' : '#f9fafb',
                        cursor: 'pointer', color: '#374151',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </FieldRow>

            <FieldRow label="Style">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {[
                  ['B', 'bold',          'Bold'],
                  ['I', 'italic',        'Italic'],
                  ['U', 'underline',     'Underline'],
                  ['S', 'strikethrough', 'Strikethrough'],
                ].map(([lbl, key, title]) => (
                  <button
                    key={key}
                    type="button"
                    title={title}
                    onClick={() => updateTypo({ [key]: !t[key] })}
                    style={{
                      width: 28, height: 26, borderRadius: 5,
                      border: `1px solid ${t[key] ? '#3b82f6' : '#d1d5db'}`,
                      background: t[key] ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      fontWeight: lbl === 'B' ? 700 : 400,
                      fontStyle:  lbl === 'I' ? 'italic' : 'normal',
                      textDecoration: lbl === 'U' ? 'underline' : lbl === 'S' ? 'line-through' : 'none',
                      color: t[key] ? '#1d4ed8' : '#374151',
                      fontSize: 12,
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </FieldRow>

            <FieldRow label="Alignment">
              <div style={{ display: 'flex', gap: 5 }}>
                {[
                  ['left',    '⬅'],
                  ['center',  '☰'],
                  ['right',   '➡'],
                  ['justify', '☰'],
                ].map(([val, icon]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => updateTypo({ align: val })}
                    title={val}
                    style={{
                      flex: 1, height: 26, borderRadius: 5,
                      border: `1px solid ${t.align === val ? '#3b82f6' : '#d1d5db'}`,
                      background: t.align === val ? '#eff6ff' : '#fff',
                      cursor: 'pointer', fontSize: 11,
                      color: t.align === val ? '#1d4ed8' : '#374151',
                    }}
                  >
                    {val.charAt(0).toUpperCase() + val.slice(1, 3)}
                  </button>
                ))}
              </div>
            </FieldRow>

            <FieldRow label="Color">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={t.color || '#333333'}
                  onChange={e => updateTypo({ color: e.target.value })}
                  style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
                />
                <Input value={t.color || '#333333'} onChange={v => updateTypo({ color: v })} />
              </div>
            </FieldRow>

            <FieldRow label="Highlight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={t.highlight || '#ffffff'}
                  onChange={e => updateTypo({ highlight: e.target.value })}
                  style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
                />
                <button
                  type="button"
                  onClick={() => updateTypo({ highlight: null })}
                  style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', background: '#f9fafb', color: '#6b7280' }}
                >
                  Clear
                </button>
              </div>
            </FieldRow>

            <FieldRow label="Line Height">
              <input
                type="range" min={1} max={3} step={0.1}
                value={t.lineHeight || 1.5}
                onChange={e => updateTypo({ lineHeight: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>{(t.lineHeight || 1.5).toFixed(1)}</div>
            </FieldRow>

            <FieldRow label="Letter Spacing (pt)">
              <input
                type="range" min={-2} max={10} step={0.5}
                value={t.letterSpacing || 0}
                onChange={e => updateTypo({ letterSpacing: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>{t.letterSpacing || 0} pt</div>
            </FieldRow>
          </div>
        </>
      )}

      {/* Content for text/heading */}
      {[ELEMENT_TYPES.TEXT, ELEMENT_TYPES.HEADING].includes(el.type) && (
        <FieldRow label="Content">
          <textarea
            value={el.content || ''}
            onChange={e => onUpdate({ content: e.target.value })}
            rows={3}
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </FieldRow>
      )}

      {/* Dynamic field placeholder */}
      {el.type === ELEMENT_TYPES.DYNAMIC_FIELD && (
        <FieldRow label="Placeholder">
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <Input
              value={el.placeholder || ''}
              onChange={v => onUpdate({ placeholder: v })}
              placeholder="{{table.column}}"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => onOpenFieldPanel && onOpenFieldPanel()}
              style={{
                padding: '5px 9px', fontSize: 10, borderRadius: 6,
                border: '1px solid #bfdbfe', background: '#eff6ff',
                cursor: 'pointer', color: '#1d4ed8', fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Browse
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>
            e.g. {'{{employee.full_name}}'} or {'{{finance.salary}}'}
          </div>
          {/* Inline compact schema picker */}
          {schema && (
            <select
              defaultValue=""
              onChange={e => {
                if (e.target.value) onUpdate({ placeholder: e.target.value });
                e.target.value = '';
              }}
              style={{ width: '100%', marginTop: 5, padding: '5px 8px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 5 }}
            >
              <option value="">— quick pick from schema —</option>
              {Object.entries(schema)
                .filter(([t]) => !['audit_logs','delivery_logs','digital_signatures','generated_docs','notifications','signature_requests','system_settings','template_placeholders','template_versions','templates','field_mappings'].includes(t))
                .map(([table, cols]) => (
                  <optgroup key={table} label={table}>
                    {cols.map(c => (
                      <option key={c.field} value={c.placeholder}>{c.placeholder}</option>
                    ))}
                  </optgroup>
                ))
              }
            </select>
          )}
          <FieldRow label="Label (editor only)">
            <Input
              value={el.label || ''}
              onChange={v => onUpdate({ label: v })}
              placeholder="e.g. Employee Name"
            />
          </FieldRow>
          <FieldRow label="Fallback (if empty)">
            <Input
              value={el.fallback || ''}
              onChange={v => onUpdate({ fallback: v })}
              placeholder="Leave blank to remove"
            />
          </FieldRow>
        </FieldRow>
      )}

      {/* Conditional block — full editor */}
      {el.type === ELEMENT_TYPES.CONDITIONAL_BLOCK && (
        <ConditionalBlockEditor el={el} onUpdate={onUpdate} schema={schema} />
      )}

      {/* Repeat block — full editor */}
      {el.type === ELEMENT_TYPES.REPEAT_BLOCK && (
        <RepeatBlockEditor el={el} onUpdate={onUpdate} schema={schema} />
      )}

      {/* ── Watermark ── */}
      {el.type === ELEMENT_TYPES.WATERMARK && (
        <>
          {/* ── Mode switcher ── */}
          <FieldRow label="Watermark Type">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['text', '≋ Text'], ['image', '🖼 Image']].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdate({ watermarkMode: val })}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                    borderRadius: 6, cursor: 'pointer',
                    border: (el.watermarkMode || 'text') === val ? '2px solid #6366f1' : '1px solid #d1d5db',
                    background: (el.watermarkMode || 'text') === val ? '#eef2ff' : '#f9fafb',
                    color: (el.watermarkMode || 'text') === val ? '#4f46e5' : '#374151',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </FieldRow>

          {/* ── Text mode controls ── */}
          {(el.watermarkMode || 'text') === 'text' && (
            <>
              <FieldRow label="Watermark Text">
                <Input
                  value={el.text || ''}
                  onChange={v => onUpdate({ text: v })}
                  placeholder="CONFIDENTIAL"
                />
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                  Click to edit: CONFIDENTIAL → TEMPORARY CERTIFICATE → any text
                </div>
              </FieldRow>

              {/* Full typography section for watermark text */}
              <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Text Style</div>

                <FieldRow label="Font Family">
                  <Select
                    value={t.fontFamily || 'Roboto'}
                    onChange={v => updateTypo({ fontFamily: v })}
                    options={FONT_FAMILIES}
                  />
                </FieldRow>

                <FieldRow label="Font Size (pt)">
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="number" min={6} max={200}
                      value={t.fontSize || 72}
                      onChange={e => updateTypo({ fontSize: Number(e.target.value) })}
                      style={{ width: 65, padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
                    />
                    {[36, 48, 60, 72, 96].map(s => (
                      <button
                        key={s} type="button"
                        onClick={() => updateTypo({ fontSize: s })}
                        style={{
                          padding: '2px 5px', fontSize: 10, borderRadius: 4,
                          border: '1px solid #d1d5db',
                          background: t.fontSize === s ? '#eff6ff' : '#f9fafb',
                          cursor: 'pointer', color: '#374151',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </FieldRow>

                <FieldRow label="Style">
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[
                      ['B', 'bold',      'Bold',      { fontWeight: 700 }],
                      ['I', 'italic',    'Italic',    { fontStyle: 'italic' }],
                      ['U', 'underline', 'Underline', { textDecoration: 'underline' }],
                    ].map(([lbl, key, title, styleOn]) => (
                      <button
                        key={key} type="button" title={title}
                        onClick={() => updateTypo({ [key]: !t[key] })}
                        style={{
                          width: 28, height: 28, borderRadius: 5,
                          border: t[key] ? '1.5px solid #6366f1' : '1px solid #d1d5db',
                          background: t[key] ? '#eef2ff' : '#f9fafb',
                          cursor: 'pointer', color: t[key] ? '#4f46e5' : '#374151',
                          fontSize: 12, ...(t[key] ? styleOn : {}),
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </FieldRow>

                <FieldRow label="Text Color">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={t.color || '#aaaaaa'}
                      onChange={e => updateTypo({ color: e.target.value })}
                      style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
                    />
                    <Input value={t.color || '#aaaaaa'} onChange={v => updateTypo({ color: v })} />
                  </div>
                </FieldRow>

                <FieldRow label="Alignment">
                  <Select
                    value={t.align || 'center'}
                    onChange={v => updateTypo({ align: v })}
                    options={[
                      { value: 'left',    label: 'Left' },
                      { value: 'center',  label: 'Center' },
                      { value: 'right',   label: 'Right' },
                    ]}
                  />
                </FieldRow>
              </div>
            </>
          )}

          {/* ── Image mode controls ── */}
          {(el.watermarkMode || 'text') === 'image' && (
            <>
              <FieldRow label="Image">
                {el.imageUrl ? (
                  <>
                    <div style={{
                      border: '1px solid #d1d5db', borderRadius: 7, padding: 8,
                      background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
                      textAlign: 'center', marginBottom: 6,
                    }}>
                      <img
                        src={el.imageUrl}
                        alt="Watermark"
                        style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label style={{
                        flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600,
                        borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb',
                        cursor: 'pointer', color: '#374151', textAlign: 'center',
                      }}>
                        Replace
                        <input
                          type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => onUpdate({ imageUrl: ev.target.result });
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onUpdate({ imageUrl: null })}
                        style={{ flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                ) : (
                  <label style={{
                    display: 'block', width: '100%', padding: '14px 0', textAlign: 'center',
                    fontSize: 12, fontWeight: 600,
                    borderRadius: 7, border: '1.5px dashed #f59e0b',
                    background: '#fffbeb', cursor: 'pointer', color: '#b45309',
                    boxSizing: 'border-box',
                  }}>
                    🖼️ Upload Watermark Image
                    <input
                      type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => onUpdate({ imageUrl: ev.target.result });
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </FieldRow>

              <FieldRow label="Object Fit">
                <Select
                  value={el.objectFit || 'contain'}
                  onChange={v => onUpdate({ objectFit: v })}
                  options={[
                    { value: 'contain', label: 'Contain' },
                    { value: 'cover',   label: 'Cover' },
                    { value: 'fill',    label: 'Fill' },
                  ]}
                />
              </FieldRow>
            </>
          )}

          {/* ── Shared controls (both modes) ── */}
          <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Placement</div>

            <FieldRow label="Layer">
              <Select
                value={el.layer || 'behind'}
                onChange={v => onUpdate({ layer: v })}
                options={[
                  { value: 'behind',  label: '◎ Behind Content (default)' },
                  { value: 'infront', label: '◉ In Front of Content' },
                ]}
              />
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                "Behind" is the traditional watermark look
              </div>
            </FieldRow>

            <FieldRow label="Scope">
              <Select
                value={el.scope || 'all_pages'}
                onChange={v => onUpdate({ scope: v })}
                options={[
                  { value: 'all_pages',        label: 'All pages' },
                  { value: 'first_page',       label: 'First page only' },
                  { value: 'all_except_first', label: 'All except first page' },
                ]}
              />
            </FieldRow>

            <FieldRow label="Opacity">
              <input
                type="range" min={0.02} max={0.6} step={0.01}
                value={el.opacity ?? 0.15}
                onChange={e => onUpdate({ opacity: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
                {Math.round((el.opacity ?? 0.15) * 100)}%
              </div>
            </FieldRow>

            <FieldRow label="Rotation (°)">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="range" min={-90} max={90} step={1}
                  value={el.rotation ?? -35}
                  onChange={e => onUpdate({ rotation: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number" min={-360} max={360}
                  value={el.rotation ?? -35}
                  onChange={e => onUpdate({ rotation: Number(e.target.value) })}
                  style={{ width: 55, padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
                />
              </div>
            </FieldRow>
          </div>

          <div style={{
            fontSize: 11, color: '#6b7280', padding: '8px 10px', marginTop: 6,
            background: '#f5f3ff', borderRadius: 6, border: '1px solid #ddd6fe',
          }}>
            The watermark text and style are stored as template data — not hardcoded.
            Change the text above to any value (e.g. <em>TEMPORARY CERTIFICATE</em>) and
            it will appear in saved templates, previews, and generated PDFs.
          </div>
        </>
      )}

      {/* Divider */}
      {el.type === ELEMENT_TYPES.DIVIDER && (
        <>
          <FieldRow label="Line Style">
            <Select
              value={el.lineStyle || 'solid'}
              onChange={v => onUpdate({ lineStyle: v })}
              options={['solid', 'dashed', 'dotted']}
            />
          </FieldRow>
          <FieldRow label="Color">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={el.color || '#dddddd'} onChange={e => onUpdate({ color: e.target.value })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
              />
              <Input value={el.color || '#dddddd'} onChange={v => onUpdate({ color: v })} />
            </div>
          </FieldRow>
          <FieldRow label="Line Width (pt)">
            <input
              type="number" min={0.5} max={10} step={0.5}
              value={el.lineWidth || 1}
              onChange={e => onUpdate({ lineWidth: Number(e.target.value) })}
              style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
            />
          </FieldRow>
        </>
      )}

      {/* Shape */}
      {el.type === ELEMENT_TYPES.SHAPE && (
        <>
          <FieldRow label="Shape Type">
            <Select
              value={el.shapeType || 'rectangle'}
              onChange={v => onUpdate({ shapeType: v })}
              options={['rectangle', 'circle', 'line']}
            />
          </FieldRow>
          <FieldRow label="Fill">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={el.fill || '#e0e7ff'} onChange={e => onUpdate({ fill: e.target.value })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
              />
              <Input value={el.fill || '#e0e7ff'} onChange={v => onUpdate({ fill: v })} />
            </div>
          </FieldRow>
          <FieldRow label="Stroke">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={el.stroke || '#3b5bdb'} onChange={e => onUpdate({ stroke: e.target.value })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
              />
              <Input value={el.stroke || '#3b5bdb'} onChange={v => onUpdate({ stroke: v })} />
            </div>
          </FieldRow>
        </>
      )}

      {/* Stamp */}
      {el.type === ELEMENT_TYPES.STAMP && (
        <>
          <FieldRow label="Stamp Text">
            <Input
              value={el.stampText || 'APPROVED'}
              onChange={v => onUpdate({ stampText: v })}
              placeholder="APPROVED"
            />
          </FieldRow>
          <FieldRow label="Shape">
            <Select
              value={el.stampShape || 'circle'}
              onChange={v => onUpdate({ stampShape: v })}
              options={[
                { value: 'circle',    label: '○ Circle' },
                { value: 'rectangle', label: '□ Rectangle' },
                { value: 'diamond',   label: '◇ Diamond' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Colour">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={el.stroke || '#dc2626'} onChange={e => onUpdate({ stroke: e.target.value, typography: { ...el.typography, color: e.target.value } })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
              />
              <Input value={el.stroke || '#dc2626'} onChange={v => onUpdate({ stroke: v, typography: { ...el.typography, color: v } })} />
            </div>
          </FieldRow>
          <FieldRow label="Border Width (px)">
            <input
              type="number" min={1} max={12} step={0.5}
              value={el.strokeWidth || 3}
              onChange={e => onUpdate({ strokeWidth: Number(e.target.value) })}
              style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
            />
          </FieldRow>
          <FieldRow label="Font Size (pt)">
            <input
              type="number" min={6} max={72}
              value={el.typography?.fontSize || 14}
              onChange={e => onUpdate({ typography: { ...el.typography, fontSize: Number(e.target.value) } })}
              style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
            />
          </FieldRow>
          <div style={{ fontSize: 11, color: '#6b7280', padding: '8px 10px', background: '#fff1f2', borderRadius: 6, border: '1px solid #fecaca', marginTop: 4 }}>
            Stamp is a decorative approval mark. Use Rotation and Opacity in the Transform section above.
          </div>
        </>
      )}

      {/* E-sign placeholder */}
      {el.type === ELEMENT_TYPES.ESIGN_PLACEHOLDER && (
        <>
          <FieldRow label="Role / Title">
            <Input value={el.signerRole || ''} onChange={v => onUpdate({ signerRole: v })} placeholder="approver" />
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
              Identifies which approver will fill this slot
            </div>
          </FieldRow>
          <FieldRow label="Label Text">
            <Input value={el.signerLabel || ''} onChange={v => onUpdate({ signerLabel: v })} placeholder="Approver Signature" />
          </FieldRow>
          <FieldRow label="Display">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginBottom: 5 }}>
              <input type="checkbox" checked={el.showLabel !== false} onChange={e => onUpdate({ showLabel: e.target.checked })} />
              Show role label
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={el.showBorder !== false} onChange={e => onUpdate({ showBorder: e.target.checked })} />
              Show dashed border
            </label>
          </FieldRow>
          <div style={{ fontSize: 11, color: '#6b7280', padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', marginTop: 4 }}>
            The actual digital approval (HMAC e-signature) is applied by the existing approver workflow and is separate from this visual placeholder.
          </div>
        </>
      )}

      {/* Uploaded signature */}
      {el.type === ELEMENT_TYPES.SIGNATURE_UPLOADED && (
        <>
          {el.src ? (
            <FieldRow label="Current Image">
              <div style={{
                border: '1px solid #d1d5db', borderRadius: 7, padding: 8,
                background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
                textAlign: 'center', marginBottom: 6,
              }}>
                <img src={el.src} alt="Signature" style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => onOpenSigUpload && onOpenSigUpload(el.id)}
                  style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
                >
                  Replace Image
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ src: null, serverUrl: null })}
                  style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}
                >
                  Clear
                </button>
              </div>
            </FieldRow>
          ) : (
            <FieldRow label="Image">
              <button
                type="button"
                onClick={() => onOpenSigUpload && onOpenSigUpload(null)}
                style={{ width: '100%', padding: '10px 0', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1.5px dashed #38bdf8', background: '#f0f9ff', cursor: 'pointer', color: '#0369a1' }}
              >
                📁 Choose Image
              </button>
            </FieldRow>
          )}
          <FieldRow label="Label">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginBottom: 5 }}>
              <input type="checkbox" checked={el.showLabel !== false} onChange={e => onUpdate({ showLabel: e.target.checked })} />
              Show label below image
            </label>
            {el.showLabel !== false && (
              <Input value={el.labelText || ''} onChange={v => onUpdate({ labelText: v })} placeholder="Authorised Signature" />
            )}
          </FieldRow>
          <FieldRow label="Placeholder Token">
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>
              Optional: override with a dynamic placeholder (e.g. for the approver's signature image resolved at generation time).
            </div>
            <Input
              value={el.placeholder || ''}
              onChange={v => onUpdate({ placeholder: v })}
              placeholder="Leave empty to use uploaded image"
            />
          </FieldRow>
        </>
      )}

      {/* Drawn signature */}
      {el.type === ELEMENT_TYPES.SIGNATURE_DRAWN && (
        <>
          {el.src ? (
            <FieldRow label="Current Drawing">
              <div style={{
                border: '1px solid #d1d5db', borderRadius: 7, padding: 8,
                background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
                textAlign: 'center', marginBottom: 6,
              }}>
                <img src={el.src} alt="Drawn signature" style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => onOpenSigDraw && onOpenSigDraw(el.id)}
                  style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
                >
                  Redraw
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ src: null })}
                  style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}
                >
                  Clear
                </button>
              </div>
            </FieldRow>
          ) : (
            <FieldRow label="Drawing">
              <button
                type="button"
                onClick={() => onOpenSigDraw && onOpenSigDraw(null)}
                style={{ width: '100%', padding: '10px 0', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1.5px dashed #c084fc', background: '#fdf4ff', cursor: 'pointer', color: '#7e22ce' }}
              >
                ✒️ Draw Signature
              </button>
            </FieldRow>
          )}
          <FieldRow label="Label">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginBottom: 5 }}>
              <input type="checkbox" checked={el.showLabel !== false} onChange={e => onUpdate({ showLabel: e.target.checked })} />
              Show label below drawing
            </label>
            {el.showLabel !== false && (
              <Input value={el.labelText || ''} onChange={v => onUpdate({ labelText: v })} placeholder="Signature" />
            )}
          </FieldRow>
        </>
      )}

      {/* Company Seal */}
      {el.type === ELEMENT_TYPES.COMPANY_SEAL && (
        <>
          {/* Live preview of the actual seal */}
          <FieldRow label="Seal Preview">
            {el.src ? (
              <div style={{
                border: '1px solid #d1d5db', borderRadius: 7, padding: 8,
                background: '#faf5ff', textAlign: 'center', marginBottom: 6,
              }}>
                <img
                  src={el.src}
                  alt="Company Seal"
                  style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain', borderRadius: '50%' }}
                />
              </div>
            ) : (
              <div style={{
                border: '1.5px dashed #7c3aed', borderRadius: '50%', padding: 12,
                background: '#faf5ff', textAlign: 'center', marginBottom: 6,
                color: '#7c3aed', fontSize: 11,
              }}>
                ◉ No seal uploaded yet.<br />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>
                  Upload in System Settings → Branding
                </span>
              </div>
            )}
          </FieldRow>

          <FieldRow label="Shape">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={el.circular !== false}
                onChange={e => onUpdate({ circular: e.target.checked })}
              />
              Circular clip
            </label>
          </FieldRow>

          <FieldRow label="Fit">
            <Select
              value={el.objectFit || 'contain'}
              onChange={v => onUpdate({ objectFit: v })}
              options={['contain', 'cover', 'fill']}
            />
          </FieldRow>

          <FieldRow label="Label">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginBottom: 5 }}>
              <input type="checkbox" checked={el.showLabel === true} onChange={e => onUpdate({ showLabel: e.target.checked })} />
              Show label below seal
            </label>
            {el.showLabel && (
              <Input value={el.label || ''} onChange={v => onUpdate({ label: v })} placeholder="Official Seal" />
            )}
          </FieldRow>

          <div style={{ fontSize: 11, color: '#6b7280', padding: '8px 10px', background: '#faf5ff', borderRadius: 6, border: '1px solid #e9d5ff', marginTop: 4 }}>
            The seal image is pulled from <strong>System Settings → Branding</strong> at PDF generation time using <code>{'{{system.company_seal}}'}</code>.
            Move, resize, rotate, and adjust opacity using the canvas handles.
          </div>
        </>
      )}

      {/* Company Logo */}
      {el.type === ELEMENT_TYPES.LOGO && (
        <>
          <FieldRow label="Logo Source">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['system', '🏢 System Logo'], ['custom', '📁 Custom']].map(([val, lbl]) => (
                <button key={val} type="button"
                  onClick={() => onUpdate({ sourceType: val })}
                  style={{
                    flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 600,
                    borderRadius: 6, cursor: 'pointer',
                    border: (el.sourceType || 'system') === val ? '2px solid #1d4ed8' : '1px solid #d1d5db',
                    background: (el.sourceType || 'system') === val ? '#eff6ff' : '#f9fafb',
                    color: (el.sourceType || 'system') === val ? '#1d4ed8' : '#374151',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </FieldRow>
          {(el.sourceType || 'system') === 'system' ? (
            <div style={{ fontSize: 10, color: '#6b7280', padding: '8px 10px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', marginBottom: 8 }}>
              Uses <code>{'{{system.logo_url}}'}</code> — resolved at PDF generation from System Settings → Branding.
            </div>
          ) : (
            <FieldRow label="Custom Logo Image">
              {el.src ? (
                <>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: 8, textAlign: 'center', marginBottom: 6 }}>
                    <img src={el.src} alt="Logo" style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', color: '#374151', textAlign: 'center' }}>
                      Replace
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => onUpdate({ src: ev.target.result }); r.readAsDataURL(f); e.target.value = ''; }}
                      />
                    </label>
                    <button type="button" onClick={() => onUpdate({ src: null })}
                      style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}>
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <label style={{ display: 'block', width: '100%', padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1.5px dashed #93c5fd', background: '#eff6ff', cursor: 'pointer', color: '#1d4ed8', boxSizing: 'border-box' }}>
                  🏢 Upload Logo Image
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => onUpdate({ src: ev.target.result }); r.readAsDataURL(f); e.target.value = ''; }}
                  />
                </label>
              )}
            </FieldRow>
          )}
          <FieldRow label="Alt Text">
            <Input value={el.alt || ''} onChange={v => onUpdate({ alt: v })} placeholder="Company Logo" />
          </FieldRow>
          <FieldRow label="Fit">
            <Select value={el.objectFit || 'contain'} onChange={v => onUpdate({ objectFit: v })}
              options={['contain', 'cover', 'fill']} />
          </FieldRow>
        </>
      )}

      {/* Page Number */}
      {el.type === ELEMENT_TYPES.PAGE_NUMBER && (
        <>
          <FieldRow label="Format">
            <Select
              value={el.format || 'page_of_total'}
              onChange={v => onUpdate({ format: v })}
              options={[
                { value: 'page_of_total', label: 'Page X of Y' },
                { value: 'page_only',     label: 'Page X' },
                { value: 'custom',        label: 'Custom text' },
              ]}
            />
          </FieldRow>
          {el.format === 'custom' && (
            <FieldRow label="Custom Text">
              <Input
                value={el.customText || 'Page {{page_number}} of {{total_pages}}'}
                onChange={v => onUpdate({ customText: v })}
                placeholder="Page {{page_number}} of {{total_pages}}"
              />
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                Use {'{{page_number}}'} and {'{{total_pages}}'}
              </div>
            </FieldRow>
          )}
          <FieldRow label="Font Size (pt)">
            <input type="number" min={6} max={20}
              value={el.typography?.fontSize || 9}
              onChange={e => onUpdate({ typography: { ...el.typography, fontSize: Number(e.target.value) } })}
              style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
            />
          </FieldRow>
          <FieldRow label="Text Color">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={el.typography?.color || '#6b7280'}
                onChange={e => onUpdate({ typography: { ...el.typography, color: e.target.value } })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }} />
              <Input value={el.typography?.color || '#6b7280'}
                onChange={v => onUpdate({ typography: { ...el.typography, color: v } })} />
            </div>
          </FieldRow>
          <FieldRow label="Alignment">
            <Select value={el.typography?.align || 'center'}
              onChange={v => onUpdate({ typography: { ...el.typography, align: v } })}
              options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
          </FieldRow>
          <div style={{ fontSize: 10, color: '#6b7280', padding: '7px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            Page numbers are resolved at PDF generation time by the PDF engine. The values shown in preview are placeholders.
          </div>
        </>
      )}

      {/* Document Date */}
      {el.type === ELEMENT_TYPES.DOC_DATE && (
        <>
          <FieldRow label="Date Field">
            <Select
              value={el.dateField || 'generation_date'}
              onChange={v => onUpdate({ dateField: v })}
              options={[
                { value: 'generation_date', label: 'Generation Date' },
                { value: 'issue_date',      label: 'Issue Date' },
                { value: 'effective_date',  label: 'Effective Date' },
                { value: 'custom',          label: 'Custom field' },
              ]}
            />
          </FieldRow>
          {el.dateField === 'custom' && (
            <FieldRow label="Custom Placeholder">
              <Input value={el.customField || ''} onChange={v => onUpdate({ customField: v })}
                placeholder="{{your.date_field}}" />
            </FieldRow>
          )}
          <FieldRow label="Prefix Text">
            <Input value={el.prefix || ''} onChange={v => onUpdate({ prefix: v })}
              placeholder="e.g. Date: " />
          </FieldRow>
          <FieldRow label="Font Size (pt)">
            <input type="number" min={6} max={20}
              value={el.typography?.fontSize || 9}
              onChange={e => onUpdate({ typography: { ...el.typography, fontSize: Number(e.target.value) } })}
              style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
            />
          </FieldRow>
          <FieldRow label="Text Color">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={el.typography?.color || '#6b7280'}
                onChange={e => onUpdate({ typography: { ...el.typography, color: e.target.value } })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }} />
              <Input value={el.typography?.color || '#6b7280'}
                onChange={v => onUpdate({ typography: { ...el.typography, color: v } })} />
            </div>
          </FieldRow>
        </>
      )}

      {/* Document Info */}
      {el.type === ELEMENT_TYPES.DOC_INFO && (
        <>
          <FieldRow label="Info Type">
            <Select
              value={el.infoType || 'doc_id'}
              onChange={v => onUpdate({ infoType: v })}
              options={[
                { value: 'doc_id',        label: 'Document ID' },
                { value: 'ref_number',    label: 'Reference Number' },
                { value: 'template_name', label: 'Template Name' },
                { value: 'custom',        label: 'Custom field' },
              ]}
            />
          </FieldRow>
          {el.infoType === 'custom' && (
            <FieldRow label="Custom Placeholder">
              <Input value={el.customField || ''} onChange={v => onUpdate({ customField: v })}
                placeholder="{{your.field}}" />
            </FieldRow>
          )}
          <FieldRow label="Prefix Text">
            <Input value={el.prefix || ''} onChange={v => onUpdate({ prefix: v })}
              placeholder="e.g. Ref: " />
          </FieldRow>
          <FieldRow label="Font Size (pt)">
            <input type="number" min={6} max={20}
              value={el.typography?.fontSize || 9}
              onChange={e => onUpdate({ typography: { ...el.typography, fontSize: Number(e.target.value) } })}
              style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
            />
          </FieldRow>
          <FieldRow label="Text Color">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={el.typography?.color || '#6b7280'}
                onChange={e => onUpdate({ typography: { ...el.typography, color: e.target.value } })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }} />
              <Input value={el.typography?.color || '#6b7280'}
                onChange={v => onUpdate({ typography: { ...el.typography, color: v } })} />
            </div>
          </FieldRow>
        </>
      )}
    </div>
  );
}

// ── History hook ──────────────────────────────────────────────────────────────
function useHistory(initial) {
  const [stack, setStack] = useState([initial]);
  const [cursor, setCursor] = useState(0);

  const push = useCallback((state) => {
    setStack(prev => {
      const next = prev.slice(0, cursor + 1);
      next.push(state);
      if (next.length > 50) next.shift();
      return next;
    });
    setCursor(c => Math.min(c + 1, 49));
  }, [cursor]);

  const undo = useCallback(() => {
    setCursor(c => Math.max(0, c - 1));
    return stack[Math.max(0, cursor - 1)];
  }, [stack, cursor]);

  const redo = useCallback(() => {
    setCursor(c => Math.min(stack.length - 1, c + 1));
    return stack[Math.min(stack.length - 1, cursor + 1)];
  }, [stack, cursor]);

  const canUndo = cursor > 0;
  const canRedo = cursor < stack.length - 1;
  const current = stack[cursor];

  return { current, push, undo, redo, canUndo, canRedo };
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TemplateEditorPage() {
  const { id }    = useParams();
  const isEdit    = Boolean(id);
  const navigate  = useNavigate();
  const toast     = useToast();

  // ── Template metadata ────────────────────────────────────────────────────
  const [meta, setMeta] = useState({
    name:         '',
    category:     'HR',
    description:  '',
    version:      1,
    is_active:    true,
    data_source:  'users',
    watermark_text: '',
    // Auto-seal
    auto_seal_enabled: false,
    seal_section:      'header',
    seal_element_id:   null,
  });

  // ── Live seal preview src (fetched from system settings) ─────────────────
  const [sealPreviewSrc, setSealPreviewSrc] = useState(null);

  // ── Layout config ────────────────────────────────────────────────────────
  const [layoutConfig, setLayoutConfig] = useState(defaultLayoutConfig());

  // ── Editor data (history-aware) ───────────────────────────────────────────
  const history = useHistory(defaultEditorData());
  const editorData = history.current;

  const updateEditorData = useCallback((nextData) => {
    history.push(nextData);
  }, [history]);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedId, setSelectedId]         = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);

  // ── Drag type (from insert panel) ────────────────────────────────────────
  const [dragType, setDragType] = useState(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [zoom, setZoom]                   = useState(0.9);
  const [showGrid, setShowGrid]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [schema, setSchema]               = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [showFieldPanel, setShowFieldPanel] = useState(false);
  const [showPreview, setShowPreview]       = useState(false);
  const [showSigUpload, setShowSigUpload]   = useState(false);
  const [showSigDraw, setShowSigDraw]       = useState(false);
  // When replacing an existing signature image, track the element being edited
  const [sigEditId, setSigEditId]           = useState(null);
  const [sigEditSection, setSigEditSection] = useState(null);
  // Version history panel
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  // Ref to the last-saved editor data — used for the "unsaved changes" indicator.
  // We store a JSON string so reference equality works for comparison.
  const lastSavedEditorDataRef = useRef(null);
  // Inline editing state — which element (by id) is currently being edited inline
  const [editingId,      setEditingId]      = useState(null);
  const [editingSection, setEditingSection] = useState(null);

  // ── Load template on edit ─────────────────────────────────────────────────
  useEffect(() => {
    setSchemaLoading(true);
    axiosInstance.get('/templates/schema')
      .then(r => setSchema(r.data))
      .catch(() => {})
      .finally(() => setSchemaLoading(false));
    // Fetch current company seal for editor preview
    axiosInstance.get('/settings/system')
      .then(r => {
        const sealUrl = r.data?.institution?.seal_url;
        if (sealUrl) {
          // seal_url is stored as 'storage/uploads/...' — serve via /uploads/...
          const previewUrl = sealUrl.startsWith('http') || sealUrl.startsWith('data:')
            ? sealUrl
            : `/${sealUrl.replace(/^storage\//, '')}`;
          setSealPreviewSrc(previewUrl);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    axiosInstance.get(`/templates/${id}`)
      .then(res => {
        const t = hydrateTemplate(res.data);
        setMeta({
          name:          t.name || '',
          category:      t.category || 'HR',
          description:   t.description || '',
          version:       t.version || 1,
          is_active:     t.is_active ?? true,
          data_source:   t.data_source || 'users',
          watermark_text: t.watermark_text || '',
          auto_seal_enabled: !!t.auto_seal_enabled,
          seal_section:      t.seal_section || 'header',
          seal_element_id:   t.seal_element_id || null,
        });
        if (t.layout_config) setLayoutConfig(t.layout_config);
        if (t.editor_data)   history.push(t.editor_data);
        // Stamp last-saved baseline for unsaved-changes detection
        lastSavedEditorDataRef.current = JSON.stringify(t.editor_data ?? null);
      })
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Copy/paste clipboard ─────────────────────────────────────────────────
  const clipboardRef = useRef(null); // stores a deep-cloned element object

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (history.canUndo) history.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (history.canRedo) history.redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && selectedSection && !editingId) {
          handleDeleteElement(selectedSection, selectedId);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedId && selectedSection && !editingId) {
          handleDuplicateElement(selectedSection, selectedId);
        }
      }
      // Ctrl+C — copy selected element to in-memory clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedId && selectedSection && !editingId) {
          const sec = getSection(selectedSection);
          const el  = sec.elements.find(e => e.id === selectedId);
          if (el) clipboardRef.current = JSON.parse(JSON.stringify(el));
        }
      }
      // Ctrl+V — paste clipboard element (offset 20pt so it's visible)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboardRef.current && !editingId) {
          e.preventDefault();
          const targetSection = selectedSection || 'body';
          const copy = {
            ...JSON.parse(JSON.stringify(clipboardRef.current)),
            id: generateId(),
            x: (clipboardRef.current.x || 0) + 20,
            y: (clipboardRef.current.y || 0) + 20,
          };
          const sec = getSection(targetSection);
          updateEditorData({
            ...editorData,
            [targetSection]: { ...sec, elements: [...(sec.elements || []), copy] },
          });
          setSelectedId(copy.id);
          setSelectedSection(targetSection);
        }
      }
      if (e.key === 'Escape') {
        setEditingId(null);
        setEditingSection(null);
        setSelectedId(null);
        setSelectedSection(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, selectedSection, history, editingId, editorData]);

  // ── Element operations ────────────────────────────────────────────────────
  const getSection = (sectionName) => editorData?.[sectionName] || { elements: [] };

  const handleUpdateElement = useCallback((sectionName, elId, patch) => {
    const sec = getSection(sectionName);
    const nextElements = sec.elements.map(el =>
      el.id === elId ? { ...el, ...patch } : el
    );
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, elements: nextElements },
    });
  }, [editorData, updateEditorData]);

  const handleDeleteElement = useCallback((sectionName, elId) => {
    const sec = getSection(sectionName);
    const nextElements = sec.elements.filter(el => el.id !== elId);
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, elements: nextElements },
    });
    setSelectedId(null);
    setSelectedSection(null);
  }, [editorData, updateEditorData]);

  const handleDuplicateElement = useCallback((sectionName, elId) => {
    const sec = getSection(sectionName);
    const original = sec.elements.find(el => el.id === elId);
    if (!original) return;
    const copy = { ...original, id: generateId(), x: original.x + 20, y: original.y + 20 };
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, elements: [...sec.elements, copy] },
    });
    setSelectedId(copy.id);
  }, [editorData, updateEditorData]);

  const handleBringForward = useCallback((sectionName, elId) => {
    const sec = getSection(sectionName);
    const el  = sec.elements.find(e => e.id === elId);
    if (!el) return;
    handleUpdateElement(sectionName, elId, { zIndex: (el.zIndex || 0) + 1 });
  }, [editorData, handleUpdateElement]);

  const handleSendBackward = useCallback((sectionName, elId) => {
    const sec = getSection(sectionName);
    const el  = sec.elements.find(e => e.id === elId);
    if (!el) return;
    handleUpdateElement(sectionName, elId, { zIndex: Math.max(0, (el.zIndex || 0) - 1) });
  }, [editorData, handleUpdateElement]);

  const handleDropElement = useCallback((sectionName, type, x, y) => {
    const newEl = createElement(type, { x, y });
    const sec   = getSection(sectionName);
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, elements: [...sec.elements, newEl] },
    });
    setSelectedId(newEl.id);
    setSelectedSection(sectionName);
    setDragType(null);
  }, [editorData, updateEditorData]);

  // ── Insert a dynamic field from the field picker ─────────────────────────
  const handleInsertField = useCallback((placeholder, label) => {
    const targetSection = selectedSection || 'body';
    const newEl = createElement(ELEMENT_TYPES.DYNAMIC_FIELD, {
      placeholder,
      label,
      x: 40,
      y: 40,
    });
    const sec = getSection(targetSection);
    updateEditorData({
      ...editorData,
      [targetSection]: { ...sec, elements: [...(sec.elements || []), newEl] },
    });
    setSelectedId(newEl.id);
    setSelectedSection(targetSection);
  }, [editorData, selectedSection, updateEditorData]);

  // ── Auto-seal toggle ──────────────────────────────────────────────────────
  // When enabled: inserts a company_seal element into the configured section
  //   at a sensible default position (top-right corner of the section).
  // When disabled: removes the auto-managed seal element if it still exists.
  const handleAutoSealToggle = useCallback((enabled) => {
    const sealSection = meta.seal_section || 'header';

    if (enabled) {
      // Insert a new seal element; use sealPreviewSrc for live canvas preview
      const newEl = createElement(ELEMENT_TYPES.COMPANY_SEAL, {
        x:           400,   // default: right side
        y:           4,
        width:       80,
        height:      80,
        placeholder: '{{system.company_seal}}',
        src:         sealPreviewSrc || null,  // live preview in editor
        objectFit:   'contain',
        label:       'Official Seal',
        showLabel:   false,
        circular:    true,
        zIndex:      5,
      });
      const sec = getSection(sealSection);
      updateEditorData({
        ...editorData,
        [sealSection]: { ...sec, elements: [...(sec.elements || []), newEl] },
      });
      setMeta(prev => ({
        ...prev,
        auto_seal_enabled: true,
        seal_element_id:   newEl.id,
      }));
    } else {
      // Remove the managed seal element
      const elId = meta.seal_element_id;
      if (elId) {
        const sec = getSection(sealSection);
        const nextElements = (sec.elements || []).filter(e => e.id !== elId);
        updateEditorData({
          ...editorData,
          [sealSection]: { ...sec, elements: nextElements },
        });
      }
      setMeta(prev => ({
        ...prev,
        auto_seal_enabled: false,
        seal_element_id:   null,
      }));
    }
  }, [meta.seal_section, meta.seal_element_id, editorData, sealPreviewSrc, updateEditorData]);

  // ── Insert / update uploaded signature ────────────────────────────────────
  const handleInsertUploadedSig = useCallback(({ src, serverUrl, width, height, showLabel, labelText }) => {
    const targetSection = sigEditSection || selectedSection || 'body';
    if (sigEditId) {
      // Replacing image on existing element
      handleUpdateElement(targetSection, sigEditId, { src, serverUrl, width, height, showLabel, labelText });
    } else {
      const newEl = createElement(ELEMENT_TYPES.SIGNATURE_UPLOADED, {
        src, serverUrl, width, height, showLabel, labelText,
        x: 40, y: 40,
      });
      const sec = getSection(targetSection);
      updateEditorData({
        ...editorData,
        [targetSection]: { ...sec, elements: [...(sec.elements || []), newEl] },
      });
      setSelectedId(newEl.id);
      setSelectedSection(targetSection);
    }
    setSigEditId(null);
    setSigEditSection(null);
  }, [editorData, selectedSection, sigEditId, sigEditSection, updateEditorData, handleUpdateElement]);

  // ── Insert / update drawn signature ───────────────────────────────────────
  const handleInsertDrawnSig = useCallback(({ src, width, height, showLabel, labelText }) => {
    const targetSection = sigEditSection || selectedSection || 'body';
    if (sigEditId) {
      handleUpdateElement(targetSection, sigEditId, { src, width, height, showLabel, labelText });
    } else {
      const newEl = createElement(ELEMENT_TYPES.SIGNATURE_DRAWN, {
        src, width, height, showLabel, labelText,
        x: 40, y: 40,
      });
      const sec = getSection(targetSection);
      updateEditorData({
        ...editorData,
        [targetSection]: { ...sec, elements: [...(sec.elements || []), newEl] },
      });
      setSelectedId(newEl.id);
      setSelectedSection(targetSection);
    }
    setSigEditId(null);
    setSigEditSection(null);
  }, [editorData, selectedSection, sigEditId, sigEditSection, updateEditorData, handleUpdateElement]);
  const selectedEl = selectedId && selectedSection
    ? getSection(selectedSection).elements.find(e => e.id === selectedId) || null
    : null;

  // ── Layout config update ──────────────────────────────────────────────────
  const handleUpdateLayout = useCallback((patch) => {
    setLayoutConfig(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Section config update ─────────────────────────────────────────────────
  // Updates non-elements fields on a section (height, enabled, repeatOnEveryPage,
  // background, borderBottom, borderTop).
  const handleUpdateSection = useCallback((sectionName, patch) => {
    const sec = getSection(sectionName);
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, ...patch },
    });
  }, [editorData, updateEditorData]);

  // ── Select section (no element) ───────────────────────────────────────────
  const handleSelectSection = useCallback((sectionName) => {
    // If an element in this section is already selected, don't steal the
    // selection away from it — this is what causes the toolbar to go dead
    // after the user blurs the inline textarea by clicking the section background.
    if (selectedId && selectedSection === sectionName) return;
    setSelectedId(null);
    setSelectedSection(sectionName);
  }, [selectedId, selectedSection]);

  // ── Inline text editing ───────────────────────────────────────────────────
  const handleStartInlineEdit = useCallback((sectionName, elId) => {
    setEditingId(elId);
    setEditingSection(sectionName);
    setSelectedId(elId);
    setSelectedSection(sectionName);
  }, []);

  // Commits content change from the inline editor and clears editing state.
  // IMPORTANT: always re-affirms selectedId/selectedSection after clearing
  // editingId so the toolbar stays active regardless of what the blur-triggered
  // click routes through (handleSelectSection, onDeselect, etc.)
  //
  // `field` defaults to 'content' for text/heading, but DocumentCanvas also
  // passes 'placeholder' (dynamic_field) or 'text' (watermark).
  const handleCommitInlineEdit = useCallback((sectionName, elId, newValue, field = 'content') => {
    // Clear inline-edit state first
    setEditingId(null);
    setEditingSection(null);
    // Re-affirm the element as selected so the toolbar never goes dark
    setSelectedId(elId);
    setSelectedSection(sectionName);

    const sec     = getSection(sectionName);
    const current = sec.elements.find(e => e.id === elId);
    if (!current) return;
    // Only write a history entry when value actually changed
    if (current[field] === newValue) return;
    const nextElements = sec.elements.map(el =>
      el.id === elId ? { ...el, [field]: newValue } : el
    );
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, elements: nextElements },
    });
  }, [editorData, updateEditorData]);

  // Adds a new element directly (used by canvas click-to-type and quick-add button).
  const handleAddElement = useCallback((sectionName, newEl) => {
    const sec = getSection(sectionName);
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, elements: [...(sec.elements || []), newEl] },
    });
    setSelectedId(newEl.id);
    setSelectedSection(sectionName);
  }, [editorData, updateEditorData]);

  // ── WPS-style click-anywhere-to-type ─────────────────────────────────────
  // Called by DocumentCanvas ONLY when the user clicks on an EMPTY section.
  // DocumentCanvas already guards against calling this on non-empty sections.
  const handleClickToType = useCallback((sectionName, xPt, yPt) => {
    const sec    = getSection(sectionName);
    // Extra guard: if the section already has elements, just select it —
    // never create a duplicate element from a background click.
    if ((sec.elements || []).length > 0) {
      setSelectedId(null);
      setSelectedSection(sectionName);
      return;
    }
    const pagePt = 515;
    const newEl  = createElement(ELEMENT_TYPES.TEXT, {
      x:       Math.max(0, Math.min(xPt, pagePt - 80)),
      y:       Math.max(0, yPt - 12),
      width:   Math.round(pagePt * 0.85),
      height:  30,
      content: '',
    });
    updateEditorData({
      ...editorData,
      [sectionName]: { ...sec, elements: [...(sec.elements || []), newEl] },
    });
    setSelectedId(newEl.id);
    setSelectedSection(sectionName);
    setTimeout(() => handleStartInlineEdit(sectionName, newEl.id), 0);
  }, [editorData, updateEditorData]);

  // ── Render HTML from editor_data (pdfService-compatible) ────────────────
  // This is also exported as a prop to EditorPreviewModal so it can preview.
  //
  // Layout strategy for pdfmake fidelity:
  //   Elements on the canvas are absolutely positioned (x, y, width, height in pt).
  //   pdfmake does not support absolute positioning in HTML content, so we map
  //   the canvas layout to an HTML flow layout:
  //
  //   1. Elements are sorted by zIndex then grouped into "rows" by proximity
  //      of their Y coordinate (elements within 8pt of each other share a row).
  //   2. Elements in the same row are emitted as <table> columns, with each
  //      column's width proportional to the element's canvas width.
  //      A left-padding column is added when el.x > 0 to preserve horizontal position.
  //   3. Single-element rows are emitted as a block with left-margin derived from el.x.
  //   4. Watermark and QR_CODE are skipped (handled by pdfService separately).
  //
  // This approach gives a layout that closely reflects what the admin designed
  // on the canvas, while remaining fully compatible with html-to-pdfmake.
  const renderSectionHtml = useCallback((section) => {
    if (!section?.elements?.length) return '';

    // Page content width in pt (A4 = 595.28, minus default 40+40 margins = 515pt)
    // Use the actual layout_config margins when available
    const m = layoutConfig?.margins || {};
    const contentWidthPt = 515; // safe default; pdfmake reflows within its own margins

    // ── Element serialiser ────────────────────────────────────────────────
    const serializeElement = (el) => {
      if (!el || el.visible === false) return '';

      switch (el.type) {

        case ELEMENT_TYPES.TEXT:
        case ELEMENT_TYPES.HEADING: {
          const t = el.typography || {};
          const tag = el.type === ELEMENT_TYPES.HEADING ? `h${el.level || 1}` : 'p';
          const styleProps = [
            t.fontFamily    && `font-family:${t.fontFamily}`,
            t.fontSize      && `font-size:${t.fontSize}pt`,
            t.bold          && 'font-weight:bold',
            t.italic        && 'font-style:italic',
            // Combine underline and strikethrough if both are set
            (t.underline || t.strikethrough) && `text-decoration:${[t.underline ? 'underline' : '', t.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ')}`,
            t.color         && `color:${t.color}`,
            t.highlight     && `background-color:${t.highlight}`,
            t.align         && `text-align:${t.align}`,
            t.lineHeight    && `line-height:${t.lineHeight}`,
            t.letterSpacing && `letter-spacing:${t.letterSpacing}pt`,
            'margin:0 0 4px 0',
          ].filter(Boolean).join(';');
          return `<${tag} style="${styleProps}">${el.content || ''}</${tag}>`;
        }

        case ELEMENT_TYPES.DYNAMIC_FIELD: {
          // Preserve the raw placeholder — pdfService Phase 1 resolves it at generation.
          // Wrap in a <span> so surrounding text flows naturally.
          const t = el.typography || {};
          const styleProps = [
            t.fontFamily    && `font-family:${t.fontFamily}`,
            t.fontSize      && `font-size:${t.fontSize}pt`,
            t.bold          && 'font-weight:bold',
            t.italic        && 'font-style:italic',
            t.color         && `color:${t.color}`,
            t.align         && `text-align:${t.align}`,
          ].filter(Boolean).join(';');
          return `<span style="${styleProps}">${el.placeholder || ''}</span>`;
        }

        case ELEMENT_TYPES.CONDITIONAL_BLOCK: {
          if (!el.condition) return '';
          const bodyHtml = el.bodyHtml || '';
          const elseHtml = el.elseHtml || '';
          if (el.showWhen === 'falsy') {
            return `{{#if ${el.condition}}}${elseHtml}{{else}}${bodyHtml}{{/if}}`;
          }
          return elseHtml
            ? `{{#if ${el.condition}}}${bodyHtml}{{else}}${elseHtml}{{/if}}`
            : `{{#if ${el.condition}}}${bodyHtml}{{/if}}`;
        }

        case ELEMENT_TYPES.REPEAT_BLOCK: {
          if (!el.collection) return '';
          return `{{#each ${el.collection}}}${el.rowHtml || ''}{{/each}}`;
        }

        case ELEMENT_TYPES.DIVIDER: {
          const mt = el.marginTop    ?? 8;
          const mb = el.marginBottom ?? 8;
          return `<hr style="border:none;border-top:${el.lineWidth || 1}px ${el.lineStyle || 'solid'} ${el.color || '#dddddd'};margin:${mt}px 0 ${mb}px;" />`;
        }

        case ELEMENT_TYPES.IMAGE: {
          if (!el.src) return '';
          const wPt = el.width  || 150;
          const hPt = el.height || 100;
          const br  = el.borderRadius ? `border-radius:${el.borderRadius}px;` : '';
          return `<img src="${el.src}" alt="${el.alt || ''}" style="width:${wPt}pt;height:${hPt}pt;object-fit:${el.objectFit || 'contain'};${br}" />`;
        }

        case ELEMENT_TYPES.LOGO: {
          // System logo: emit {{system.logo_url}} — pdfService resolves it to a real image.
          // Custom logo: embed the uploaded base64/URL directly.
          const logoSrc = (el.sourceType === 'custom' && el.src)
            ? el.src
            : '{{system.logo_url}}';
          const wPt = el.width  || 120;
          const hPt = el.height || 50;
          const br  = el.borderRadius ? `border-radius:${el.borderRadius}px;` : '';
          return `<img src="${logoSrc}" alt="${el.alt || 'Company Logo'}" style="width:${wPt}pt;height:${hPt}pt;object-fit:${el.objectFit || 'contain'};${br}" />`;
        }

        case ELEMENT_TYPES.TABLE: {
          if (!el.cells || !el.cells.length) return '';
          const s = el.style || {};
          const rows = el.cells.map((row) => {
            const cells = row.map(cell => {
              const isH    = cell.isHeader;
              const tag    = isH ? 'th' : 'td';
              const cellBg = isH ? (s.headerBackground || '#f0f4ff') : 'transparent';
              const weight = isH && s.headerBold ? 'font-weight:bold;' : '';
              return `<${tag} style="border:${s.borderWidth || 0.5}px solid ${s.borderColor || '#dddddd'};padding:4px 6px;background:${cellBg};${weight}font-size:${s.fontSize || 10}pt;">${cell.content || ''}</${tag}>`;
            }).join('');
            return `<tr>${cells}</tr>`;
          }).join('');
          return `<table style="border-collapse:collapse;width:100%;">${rows}</table>`;
        }

        case ELEMENT_TYPES.SIGNATURE_UPLOADED: {
          const sigSrc = el.src || '';
          const sigPh  = el.placeholder || '';
          if (!sigSrc && !sigPh) return '';
          const imgSrc = sigSrc || sigPh;
          const wPt    = el.width  || 160;
          const hPt    = el.height || 60;
          const labelHtml = el.showLabel !== false && el.labelText
            ? `<div style="font-size:8pt;color:#374151;border-top:1px solid #d1d5db;padding-top:2px;margin-top:2px;">${el.labelText}</div>`
            : '';
          return `<div style="display:inline-block;vertical-align:bottom;">`
            + `<img src="${imgSrc}" style="width:${wPt}pt;height:${hPt}pt;object-fit:contain;" alt="Signature" />`
            + labelHtml
            + `</div>`;
        }

        case ELEMENT_TYPES.SIGNATURE_DRAWN: {
          if (!el.src) return '';
          const wPt = el.width  || 160;
          const hPt = el.height || 60;
          const labelHtml = el.showLabel !== false && el.labelText
            ? `<div style="font-size:8pt;color:#374151;border-top:1px solid #d1d5db;padding-top:2px;margin-top:2px;">${el.labelText}</div>`
            : '';
          return `<div style="display:inline-block;vertical-align:bottom;">`
            + `<img src="${el.src}" style="width:${wPt}pt;height:${hPt}pt;object-fit:contain;" alt="Drawn Signature" />`
            + labelHtml
            + `</div>`;
        }

        case ELEMENT_TYPES.ESIGN_PLACEHOLDER: {
          const role = el.signerLabel || el.signerRole || 'Approver';
          return `<div style="border:1px dashed #16a34a;padding:8px 12px;min-height:${el.height || 60}pt;text-align:center;background:#f0fdf4;">`
            + (el.showLabel !== false ? `<p style="font-size:8pt;color:#374151;font-weight:bold;margin:0 0 4px;">${role}</p>` : '')
            + `<p style="font-size:8pt;color:#15803d;font-weight:700;margin:0;letter-spacing:0.06em;">[ E-SIGNATURE ]</p>`
            + `<p style="font-size:7pt;color:#6b7280;margin:4px 0 0;">Applied at approval</p>`
            + `</div>`;
        }

        case ELEMENT_TYPES.COMPANY_SEAL: {
          const wPt = el.width  || 80;
          const hPt = el.height || 80;
          const sealSrc = el.placeholder || '{{system.company_seal}}';
          const clip    = el.circular !== false ? 'border-radius:50%;' : '';
          return `<img src="${sealSrc}" style="width:${wPt}pt;height:${hPt}pt;object-fit:${el.objectFit || 'contain'};${clip}" alt="Company Seal" />`;
        }

        case ELEMENT_TYPES.SHAPE: {
          const isCircle = el.shapeType === 'circle';
          const br       = isCircle ? '50%' : (el.borderRadius ? `${el.borderRadius}px` : '0');
          if (el.shapeType === 'line') {
            // Render as a horizontal rule for line shapes
            return `<div style="width:${el.width}pt;height:0;border-top:${el.strokeWidth || 1}px solid ${el.stroke || '#3b5bdb'};margin:4px 0;"></div>`;
          }
          return `<div style="width:${el.width}pt;height:${el.height}pt;background:${el.fill || '#e0e7ff'};border:${el.strokeWidth || 1}px solid ${el.stroke || '#3b5bdb'};border-radius:${br};display:inline-block;"></div>`;
        }

        case ELEMENT_TYPES.PAGE_NUMBER: {
          // Resolved in the pdfmake footer callback; emitted as placeholder tokens here.
          const fmt = el.format || 'page_of_total';
          let text;
          if (fmt === 'page_of_total')  text = 'Page {{page_number}} of {{total_pages}}';
          else if (fmt === 'page_only') text = 'Page {{page_number}}';
          else                          text = el.customText || 'Page {{page_number}} of {{total_pages}}';
          const t = el.typography || {};
          const styleProps = [
            `font-size:${t.fontSize || 9}pt`,
            `color:${t.color || '#6b7280'}`,
            t.align && `text-align:${t.align}`,
          ].filter(Boolean).join(';');
          return `<span style="${styleProps}">${text}</span>`;
        }

        case ELEMENT_TYPES.DOC_DATE: {
          const fieldMap = {
            generation_date: '{{generation_date}}',
            issue_date:      '{{issue_date}}',
            effective_date:  '{{effective_date}}',
            custom:          el.customField
              ? `{{${el.customField.replace(/^\{\{|\}\}$/g, '')}}}`
              : '{{generation_date}}',
          };
          const ph     = fieldMap[el.dateField || 'generation_date'] || '{{generation_date}}';
          const prefix = el.prefix || '';
          const t      = el.typography || {};
          const styleProps = [
            `font-size:${t.fontSize || 9}pt`,
            `color:${t.color || '#6b7280'}`,
            t.align && `text-align:${t.align}`,
          ].filter(Boolean).join(';');
          return `<span style="${styleProps}">${prefix}${ph}</span>`;
        }

        case ELEMENT_TYPES.DOC_INFO: {
          const infoMap = {
            doc_id:        '{{doc_id}}',
            ref_number:    '{{ref_number}}',
            template_name: '{{template_name}}',
            custom:        el.customField
              ? `{{${el.customField.replace(/^\{\{|\}\}$/g, '')}}}`
              : '{{doc_id}}',
          };
          const ph     = infoMap[el.infoType || 'doc_id'] || '{{doc_id}}';
          const prefix = el.prefix !== undefined ? el.prefix : 'Ref: ';
          const t      = el.typography || {};
          const styleProps = [
            `font-size:${t.fontSize || 9}pt`,
            `color:${t.color || '#6b7280'}`,
            t.align && `text-align:${t.align}`,
          ].filter(Boolean).join(';');
          return `<span style="${styleProps}">${prefix}${ph}</span>`;
        }

        case ELEMENT_TYPES.QR_CODE:
          return ''; // Always auto-added by pdfService in the footer bar — never in HTML

        case ELEMENT_TYPES.WATERMARK:
          return ''; // Handled via watermark_config — never serialised into section HTML

        case ELEMENT_TYPES.STAMP: {
          // Render as an absolutely-positioned div in HTML; pdfService approximates it
          const strokeColor = el.stroke || '#dc2626';
          const text        = el.stampText || 'APPROVED';
          const t           = el.typography || {};
          const fontSize    = t.fontSize || 14;
          const isCircle    = (el.stampShape || 'circle') === 'circle';
          const br          = isCircle ? '50%' : '6px';
          const sw          = el.strokeWidth || 3;
          return `<div style="display:inline-block;width:${el.width || 100}pt;height:${el.height || 100}pt;border:${sw}px solid ${strokeColor};border-radius:${br};text-align:center;vertical-align:middle;box-sizing:border-box;padding-top:${Math.round((el.height || 100) / 2 - fontSize / 2)}pt;"><span style="font-size:${fontSize}pt;font-weight:700;color:${strokeColor};letter-spacing:0.08em;">${text}</span></div>`;
        }

        default:
          return '';
      }
    };

    // ── Layout grouping: map canvas positions to HTML table rows ──────────
    //
    // Elements are sorted by y first, then x. Elements whose y values are
    // within ROW_THRESHOLD pts of each other are grouped into the same row.
    // Each row is emitted as a <table> with columns proportional to the
    // elements' widths and positions. A gap column handles x-offset.
    //
    // This is the closest approximation of absolute positioning available
    // inside html-to-pdfmake without requiring custom extensions.
    const ROW_THRESHOLD_PT = 12; // elements within 12pt Y are considered same row

    const visibleEls = section.elements
      .filter(el => el.visible !== false && el.type !== ELEMENT_TYPES.WATERMARK && el.type !== ELEMENT_TYPES.QR_CODE)
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));

    if (visibleEls.length === 0) return '';

    // Group into rows
    const rows = [];
    let currentRow = [];
    let rowBaseY   = visibleEls[0]?.y ?? 0;

    for (const el of visibleEls) {
      const elY = el.y ?? 0;
      if (currentRow.length > 0 && Math.abs(elY - rowBaseY) > ROW_THRESHOLD_PT) {
        rows.push(currentRow);
        currentRow = [el];
        rowBaseY   = elY;
      } else {
        if (currentRow.length === 0) rowBaseY = elY;
        currentRow.push(el);
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    // Emit rows as HTML
    const parts = rows.map(rowEls => {
      const htmls = rowEls.map(el => serializeElement(el)).filter(Boolean);
      if (htmls.length === 0) return '';

      // Single element in the row: wrap with left margin to honour x position
      if (rowEls.length === 1) {
        const el    = rowEls[0];
        const xPt   = el.x ?? 0;
        const wPt   = el.width ?? contentWidthPt;
        const lm    = xPt > 4 ? `margin-left:${xPt}pt;` : '';
        const width = wPt < contentWidthPt ? `width:${wPt}pt;` : 'width:100%;';
        return `<div style="${lm}${width}margin-bottom:4pt;">${htmls[0]}</div>`;
      }

      // Multiple elements in same row: use an HTML table for side-by-side layout.
      // Column widths are derived from el.width; a leading spacer column handles x-offset.
      // We compute the total span to figure out proportions relative to contentWidthPt.
      const sorted = [...rowEls].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const sortedHtmls = sorted.map(el => serializeElement(el)).filter(Boolean);
      if (sortedHtmls.length === 0) return '';

      const cells = sorted.map((el, i) => {
        const elHtml = sortedHtmls[i] || '';
        if (!elHtml) return '';
        const wPt  = el.width ?? 100;
        const xPt  = el.x ?? 0;
        // For the first element, add left padding to honour its x position
        const pl   = i === 0 && xPt > 4 ? `padding-left:${xPt}pt;` : '';
        return `<td style="padding:0 4pt 4pt 0;vertical-align:top;${pl}width:${wPt}pt;">${elHtml}</td>`;
      }).filter(Boolean).join('');

      return `<table style="width:100%;border-collapse:collapse;margin-bottom:4pt;"><tr>${cells}</tr></table>`;
    });

    return parts.filter(Boolean).join('\n');
  }, [layoutConfig]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (publishStatus) => {
    if (!meta.name.trim()) { toast.error('Template name is required'); return; }

    const body_html   = renderSectionHtml(editorData?.body);
    const header_html = renderSectionHtml(editorData?.header);
    const footer_html = renderSectionHtml(editorData?.footer);

    // Extract watermark element (search all sections)
    const wmEl = [
      ...(editorData?.body?.elements   || []),
      ...(editorData?.header?.elements || []),
      ...(editorData?.footer?.elements || []),
    ].find(e => e.type === ELEMENT_TYPES.WATERMARK);

    // watermark_text — kept for backward compat with old PDF route that reads it
    const watermark_text = wmEl?.text || meta.watermark_text || '';
    // watermark_config — full element config for rich PDF rendering
    const watermark_config = wmEl ? JSON.stringify(wmEl) : null;

    const payload = {
      ...meta,
      watermark_text,
      watermark_config,
      body_html:   body_html   || '<p></p>',
      header_html: header_html || null,
      footer_html: footer_html || null,
      layout_config: layoutConfig,
      editor_data:   serializeEditorData(editorData),
      is_active:         publishStatus === 'publish' ? true : meta.is_active,
      // Auto-seal fields
      auto_seal_enabled: meta.auto_seal_enabled ? 1 : 0,
      seal_section:      meta.seal_section || 'header',
      seal_element_id:   meta.seal_element_id || null,
      // Section-level config metadata (repeat, enabled, height, borders)
      // Stored inside editor_data already; also emit as flat keys for pdfService
      header_enabled:           editorData?.header?.enabled !== false ? 1 : 0,
      header_repeat_every_page: editorData?.header?.repeatOnEveryPage !== false ? 1 : 0,
      footer_enabled:           editorData?.footer?.enabled !== false ? 1 : 0,
      footer_repeat_every_page: editorData?.footer?.repeatOnEveryPage !== false ? 1 : 0,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const res = await axiosInstance.put(`/templates/${id}`, payload);
        // Server returns the new version number — update local state so the badge
        // and the unsaved-changes indicator stay in sync.
        const newVersion = res.data?.version;
        if (newVersion) {
          setMeta(prev => ({ ...prev, version: newVersion }));
        }
        // Stamp the saved baseline — no "unsaved changes" indicator right after save
        lastSavedEditorDataRef.current = JSON.stringify(editorData);
        toast.success(`Template updated (v${newVersion ?? meta.version + 1})`);
      } else {
        const res = await axiosInstance.post('/templates', payload);
        // Stamp baseline for new templates too
        lastSavedEditorDataRef.current = JSON.stringify(editorData);
        toast.success('Template created');
        navigate(`/templates/${res.data.id}/edit`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── In-editor preview (client-side with sample data) ─────────────────────
  const handleEditorPreview = () => setShowPreview(true);

  // ── PDF Preview (server-side) ─────────────────────────────────────────────
  const handlePdfPreview = async () => {
    if (!isEdit) { toast.error('Save the template first to preview PDF'); return; }
    try {
      const res = await axiosInstance.post(`/templates/${id}/preview-pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      toast.error('PDF preview failed');
    }
  };

  // ── Restore a past version ────────────────────────────────────────────────
  // Called by TemplateVersionHistoryPanel after a successful POST /restore/:v.
  // Reloads the full template from the server so the editor reflects the
  // restored content without requiring a manual page refresh.
  const handleVersionRestored = useCallback(async (newVersion) => {
    setShowVersionHistory(false);
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/templates/${id}`);
      const t   = hydrateTemplate(res.data);
      setMeta({
        name:              t.name || '',
        category:          t.category || 'HR',
        description:       t.description || '',
        version:           t.version || newVersion,
        is_active:         t.is_active ?? true,
        data_source:       t.data_source || 'users',
        watermark_text:    t.watermark_text || '',
        auto_seal_enabled: !!t.auto_seal_enabled,
        seal_section:      t.seal_section || 'header',
        seal_element_id:   t.seal_element_id || null,
      });
      if (t.layout_config) setLayoutConfig(t.layout_config);
      if (t.editor_data)   history.push(t.editor_data);
      lastSavedEditorDataRef.current = JSON.stringify(t.editor_data ?? null);
      toast.success(`Restored to v${newVersion - 1} content as v${newVersion}`);
    } catch {
      toast.error('Failed to reload template after restore');
    } finally {
      setLoading(false);
    }
  }, [id, history]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: 14 }}>
        Loading template…
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // Break out of AdminLayout's padded content area.
    // AdminNavbar is h-16 = 64px. AdminLayout footer is ~40px.
    // We use a negative margin to escape the px-6 py-5 content padding
    // WITHOUT overlapping the navbar — so we only cancel the padding,
    // not the navbar height itself.
    <div
      style={{
        margin: '-28px -24px -28px',     // cancel py-5 (20px top) + px-6 sides; top is -28 to clear sm:py-7
        display: 'flex',
        flexDirection: 'column',
        // Full viewport minus the navbar (64px) and layout footer (~41px)
        height: 'calc(100vh - 64px - 41px)',
        minHeight: 0,
        background: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        position: 'relative',          // keep stacking context inside AdminLayout
        zIndex: 0,                     // never sit above the navbar (z-10)
      }}
    >
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px',
        height: 52,
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0,
        zIndex: 100,
      }}>
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate('/templates')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 7,
            border: '1px solid #e5e7eb', background: '#f9fafb',
            cursor: 'pointer', color: '#374151', fontSize: 12, fontWeight: 500,
            flexShrink: 0,
          }}
        >
          ← Back
        </button>

        {/* Template name */}
        <input
          value={meta.name}
          onChange={e => setMeta(p => ({ ...p, name: e.target.value }))}
          placeholder="Template Name…"
          style={{
            flex: 1, maxWidth: 280,
            padding: '6px 10px', fontSize: 14, fontWeight: 600,
            border: '1px solid #d1d5db', borderRadius: 7, outline: 'none',
            color: '#111827',
          }}
        />

        {/* Category */}
        <select
          value={meta.category}
          onChange={e => setMeta(p => ({ ...p, category: e.target.value }))}
          style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, outline: 'none', background: '#ffffff', color: '#374151', flexShrink: 0 }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Description */}
        <input
          value={meta.description}
          onChange={e => setMeta(p => ({ ...p, description: e.target.value }))}
          placeholder="Description…"
          style={{ flex: 1, maxWidth: 220, padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, outline: 'none', color: '#374151' }}
        />

        <div style={{ flex: 1 }} />

        {/* Version badge + History button */}
        {isEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {/* Unsaved-changes dot */}
            {lastSavedEditorDataRef.current !== null &&
              JSON.stringify(editorData) !== lastSavedEditorDataRef.current && (
              <span title="Unsaved changes" style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#f59e0b', display: 'inline-block',
                flexShrink: 0,
              }} />
            )}
            <span style={{
              padding: '3px 9px', borderRadius: 12,
              background: '#f0f9ff', border: '1px solid #bae6fd',
              fontSize: 11, color: '#0369a1', fontWeight: 600,
            }}>
              v{meta.version}
            </span>
            <button
              type="button"
              title="View version history"
              onClick={() => setShowVersionHistory(true)}
              style={{
                padding: '4px 9px', fontSize: 11, fontWeight: 500,
                border: '1px solid #e0e7ff', borderRadius: 7,
                background: '#eef2ff', cursor: 'pointer',
                color: '#4f46e5',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e0e7ff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#eef2ff'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 8v4l3 3"/>
                <circle cx="12" cy="12" r="9"/>
              </svg>
              History
            </button>
          </div>
        ) : (
          <span style={{
            padding: '3px 9px', borderRadius: 12,
            background: '#f0f9ff', border: '1px solid #bae6fd',
            fontSize: 11, color: '#0369a1', fontWeight: 600, flexShrink: 0,
          }}>
            v1 (new)
          </span>
        )}

        {/* Status */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
          <div
            onClick={() => setMeta(p => ({ ...p, is_active: !p.is_active }))}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: meta.is_active ? '#2563eb' : '#d1d5db',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: meta.is_active ? 17 : 2,
              width: 16, height: 16,
              borderRadius: '50%', background: '#ffffff',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 11, color: meta.is_active ? '#1d4ed8' : '#9ca3af', fontWeight: 500 }}>
            {meta.is_active ? 'Active' : 'Draft'}
          </span>
        </label>

        {/* Auto-Seal toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
          <div
            onClick={() => handleAutoSealToggle(!meta.auto_seal_enabled)}
            title="Automatically include company seal in this template"
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: meta.auto_seal_enabled ? '#7c3aed' : '#d1d5db',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: meta.auto_seal_enabled ? 17 : 2,
              width: 16, height: 16,
              borderRadius: '50%', background: '#ffffff',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 11, color: meta.auto_seal_enabled ? '#7c3aed' : '#9ca3af', fontWeight: 500 }}>
            ◉ Seal
          </span>
          {meta.auto_seal_enabled && (
            <select
              value={meta.seal_section || 'header'}
              onChange={e => {
                const newSection = e.target.value;
                // Move the seal element to the new section if it exists
                const oldSection = meta.seal_section || 'header';
                const elId = meta.seal_element_id;
                if (elId && oldSection !== newSection) {
                  const oldSec = getSection(oldSection);
                  const sealEl = oldSec.elements?.find(el => el.id === elId);
                  if (sealEl) {
                    const newSec = getSection(newSection);
                    updateEditorData({
                      ...editorData,
                      [oldSection]: { ...oldSec, elements: (oldSec.elements || []).filter(el => el.id !== elId) },
                      [newSection]: { ...newSec, elements: [...(newSec.elements || []), sealEl] },
                    });
                  }
                }
                setMeta(p => ({ ...p, seal_section: newSection }));
              }}
              onClick={e => e.stopPropagation()}
              style={{ padding: '2px 4px', fontSize: 10, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none', background: '#ffffff' }}
            >
              {['header', 'body', 'footer'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </label>

        {/* Actions */}
        <button
          type="button"
          onClick={() => handleSave('draft')}
          disabled={saving}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            border: '1px solid #d1d5db', borderRadius: 7,
            background: '#f9fafb', cursor: saving ? 'not-allowed' : 'pointer',
            color: '#374151', flexShrink: 0,
          }}
        >
          Save Draft
        </button>

        <button
          type="button"
          onClick={handleEditorPreview}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            border: '1px solid #d1d5db', borderRadius: 7,
            background: '#f9fafb', cursor: 'pointer',
            color: '#374151', flexShrink: 0,
          }}
        >
          Preview
        </button>

        <button
          type="button"
          onClick={handlePdfPreview}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            border: '1px solid #d1d5db', borderRadius: 7,
            background: '#f9fafb', cursor: 'pointer',
            color: '#374151', flexShrink: 0,
          }}
        >
          Preview PDF
        </button>

        <button
          type="button"
          onClick={() => handleSave('publish')}
          disabled={saving}
          style={{
            padding: '6px 16px', fontSize: 12, fontWeight: 600,
            border: 'none', borderRadius: 7,
            background: saving ? '#93c5fd' : '#2563eb',
            cursor: saving ? 'not-allowed' : 'pointer',
            color: '#ffffff', flexShrink: 0,
          }}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Publish'}
        </button>
      </div>

      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2,
        padding: '4px 10px',
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0,
        zIndex: 99,
      }}>
        {/* Undo / Redo */}
        <TbBtn title="Undo (Ctrl+Z)" onClick={() => history.undo()} disabled={!history.canUndo}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
        </TbBtn>
        <TbBtn title="Redo (Ctrl+Y)" onClick={() => history.redo()} disabled={!history.canRedo}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>
        </TbBtn>

        <TbDivider />

        {/* Font family */}
        <select
          disabled={!selectedEl}
          value={selectedEl?.typography?.fontFamily || 'Roboto'}
          onChange={e => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, fontFamily: e.target.value } })}
          style={{ height: 28, padding: '0 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none', maxWidth: 130 }}
        >
          {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Font size */}
        <select
          disabled={!selectedEl}
          value={selectedEl?.typography?.fontSize || 11}
          onChange={e => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, fontSize: Number(e.target.value) } })}
          style={{ height: 28, width: 56, padding: '0 4px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none' }}
        >
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <TbDivider />

        {/* Bold */}
        <TbBtn
          title="Bold (Ctrl+B)"
          active={!!selectedEl?.typography?.bold}
          disabled={!selectedEl?.typography}
          onClick={() => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, bold: !selectedEl.typography.bold } })}
        >
          <strong style={{ fontSize: 13 }}>B</strong>
        </TbBtn>

        {/* Italic */}
        <TbBtn
          title="Italic (Ctrl+I)"
          active={!!selectedEl?.typography?.italic}
          disabled={!selectedEl?.typography}
          onClick={() => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, italic: !selectedEl.typography.italic } })}
        >
          <em style={{ fontSize: 13 }}>I</em>
        </TbBtn>

        {/* Underline */}
        <TbBtn
          title="Underline (Ctrl+U)"
          active={!!selectedEl?.typography?.underline}
          disabled={!selectedEl?.typography}
          onClick={() => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, underline: !selectedEl.typography.underline } })}
        >
          <span style={{ fontSize: 13, textDecoration: 'underline' }}>U</span>
        </TbBtn>

        {/* Strikethrough */}
        <TbBtn
          title="Strikethrough"
          active={!!selectedEl?.typography?.strikethrough}
          disabled={!selectedEl?.typography}
          onClick={() => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, strikethrough: !selectedEl.typography.strikethrough } })}
        >
          <span style={{ fontSize: 13, textDecoration: 'line-through' }}>S</span>
        </TbBtn>

        <TbDivider />

        {/* Text color */}
        <label title="Text Color" style={{ position: 'relative', cursor: 'pointer' }}>
          <input
            type="color"
            disabled={!selectedEl?.typography}
            value={selectedEl?.typography?.color || '#333333'}
            onChange={e => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, color: e.target.value } })}
            style={{ opacity: 0, position: 'absolute', width: 28, height: 28, cursor: 'pointer', zIndex: 1 }}
          />
          <div style={{
            width: 28, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #d1d5db', borderRadius: 5, background: '#fff', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: selectedEl?.typography?.color || '#333333' }}>A</span>
            <div style={{ width: 16, height: 3, background: selectedEl?.typography?.color || '#333333', borderRadius: 1, marginTop: 1 }} />
          </div>
        </label>

        {/* Highlight */}
        <label title="Highlight Color" style={{ position: 'relative', cursor: 'pointer' }}>
          <input
            type="color"
            disabled={!selectedEl?.typography}
            value={selectedEl?.typography?.highlight || '#ffff00'}
            onChange={e => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, highlight: e.target.value } })}
            style={{ opacity: 0, position: 'absolute', width: 28, height: 28, cursor: 'pointer', zIndex: 1 }}
          />
          <div style={{
            width: 28, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #d1d5db', borderRadius: 5, background: '#fff', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, background: selectedEl?.typography?.highlight || '#ffff00', padding: '0 2px', borderRadius: 2 }}>ab</span>
          </div>
        </label>

        <TbDivider />

        {/* Alignment */}
        {['left','center','right','justify'].map(align => (
          <TbBtn
            key={align}
            title={`Align ${align}`}
            active={selectedEl?.typography?.align === align}
            disabled={!selectedEl?.typography}
            onClick={() => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, { typography: { ...selectedEl.typography, align } })}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              {align === 'left'    && <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></>}
              {align === 'center' && <><line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></>}
              {align === 'right'  && <><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></>}
              {align === 'justify'&& <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
            </svg>
          </TbBtn>
        ))}

        <TbDivider />

        {/* Zoom controls */}
        <TbBtn title="Zoom Out" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </TbBtn>
        <span style={{ fontSize: 11, color: '#6b7280', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <TbBtn title="Zoom In" onClick={() => setZoom(z => Math.min(2.0, +(z + 0.1).toFixed(1)))}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </TbBtn>
        <TbBtn title="Reset zoom" onClick={() => setZoom(0.9)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
        </TbBtn>

        <TbDivider />

        {/* Insert Dynamic Field — opens the full field picker */}
        <TbBtn
          title="Insert Dynamic Field"
          onClick={() => setShowFieldPanel(true)}
        >
          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{'{{}}'}</span>
        </TbBtn>

        <TbDivider />
        <TbBtn title={showGrid ? 'Hide Grid' : 'Show Grid'} active={showGrid} onClick={() => setShowGrid(g => !g)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
        </TbBtn>
      </div>

      {/* ── MAIN EDITOR BODY ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: Insert Panel ────────────────────────────────────────── */}
        <div style={{
          width: 160, flexShrink: 0,
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          overflowY: 'auto',
          padding: '10px 8px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Insert
          </div>

          {INSERT_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 12 }}>
              {/* Section group header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 5px', marginBottom: 4,
                background: group.color, borderRadius: 4,
                border: `1px solid ${group.borderColor}`,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  flex: 1,
                }}>
                  {group.label}
                </span>
                {/* Indicator: which section this inserts into */}
                <span style={{
                  fontSize: 7, color: '#6b7280', fontStyle: 'italic',
                }}>
                  → {group.section}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {group.items.map(item => {
                  const targetSection = group.section;
                  return (
                    <button
                      key={`${group.label}-${item.type}`}
                      type="button"
                      title={`Add to ${targetSection}: ${item.label}`}
                      draggable
                      onDragStart={() => setDragType(item.type)}
                      onDragEnd={() => setDragType(null)}
                      onClick={() => {
                        // Signature types open their modals
                        if (item.type === ELEMENT_TYPES.SIGNATURE_UPLOADED) {
                          setSigEditId(null);
                          setSigEditSection(targetSection);
                          setShowSigUpload(true);
                          return;
                        }
                        if (item.type === ELEMENT_TYPES.SIGNATURE_DRAWN) {
                          setSigEditId(null);
                          setSigEditSection(targetSection);
                          setShowSigDraw(true);
                          return;
                        }
                        // Company seal — attach live preview src + right-side default position
                        const extraProps = item.type === ELEMENT_TYPES.COMPANY_SEAL
                          ? { src: sealPreviewSrc || null, x: targetSection === 'footer' ? 440 : 400, y: 4 }
                          : { x: 40, y: 40 };
                        const newEl = createElement(item.type, extraProps);
                        const sec   = getSection(targetSection);
                        updateEditorData({
                          ...editorData,
                          [targetSection]: { ...sec, elements: [...(sec.elements || []), newEl] },
                        });
                        setSelectedId(newEl.id);
                        setSelectedSection(targetSection);
                        // For text/heading: immediately open inline editor (WPS-style)
                        if (item.type === ELEMENT_TYPES.TEXT || item.type === ELEMENT_TYPES.HEADING) {
                          setTimeout(() => handleStartInlineEdit(targetSection, newEl.id), 30);
                        }
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '6px 4px', gap: 2,
                        background: '#f9fafb', border: `1px solid ${group.borderColor}`,
                        borderRadius: 6, cursor: 'grab',
                        color: '#374151', fontSize: 10,
                        transition: 'background 0.1s, border-color 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = group.color; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; }}
                    >
                      <span style={{ fontSize: 13, lineHeight: 1 }}>{item.icon}</span>
                      <span style={{ fontSize: 8, textAlign: 'center', color: '#6b7280' }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── CENTRE: Canvas area ───────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#e8ecf0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 16px 40px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedId(null);
              setSelectedSection(null);
            }
          }}
        >
          {/* Zoom wrapper */}
          <div style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            marginBottom: `calc((${zoom} - 1) * -100%)`,
          }}>
            <DocumentCanvas
              editorData={editorData}
              layoutConfig={layoutConfig}
              selectedId={selectedId}
              selectedSection={selectedSection}
              editingId={editingId}
              onSelect={(id, sec) => {
                // Clicking a different element while inline-editing commits the current edit
                if (editingId && (id !== editingId || sec !== editingSection)) {
                  setEditingId(null);
                  setEditingSection(null);
                }
                setSelectedId(id);
                setSelectedSection(sec);
              }}
              onSelectSection={handleSelectSection}
              onDeselect={() => {
                // Only clear selection if we're not in or just finishing an inline edit.
                // When the textarea blurs from a click on the canvas background,
                // handleCommitInlineEdit already re-affirms selection — we must not
                // then immediately clobber it here.
                if (editingId) {
                  // Let handleCommitInlineEdit handle selection re-affirmation
                  setEditingId(null);
                  setEditingSection(null);
                  return;
                }
                setSelectedId(null);
                setSelectedSection(null);
              }}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              onDuplicateElement={handleDuplicateElement}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
              onUpdateSection={handleUpdateSection}
              onDropElement={handleDropElement}
              onStartInlineEdit={handleStartInlineEdit}
              onCommitInlineEdit={handleCommitInlineEdit}
              onAddElement={handleAddElement}
              onClickToType={handleClickToType}
              zoom={zoom}
              showGrid={showGrid}
              dragType={dragType}
            />
          </div>
        </div>

        {/* ── RIGHT: Properties Panel ───────────────────────────────────── */}
        <div style={{
          width: 240, flexShrink: 0,
          background: '#ffffff',
          borderLeft: '1px solid #e5e7eb',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <PropertiesPanel
            el={selectedEl}
            section={selectedSection}
            sectionData={selectedSection && !selectedEl ? editorData?.[selectedSection] : null}
            onUpdate={(patch) => selectedEl && handleUpdateElement(selectedSection, selectedEl.id, patch)}
            onUpdateSection={handleUpdateSection}
            layoutConfig={layoutConfig}
            onUpdateLayout={handleUpdateLayout}
            schema={schema}
            onOpenFieldPanel={() => setShowFieldPanel(true)}
            onOpenSigUpload={(elId) => {
              setSigEditId(elId);
              setSigEditSection(selectedSection);
              setShowSigUpload(true);
            }}
            onOpenSigDraw={(elId) => {
              setSigEditId(elId);
              setSigEditSection(selectedSection);
              setShowSigDraw(true);
            }}
          />
        </div>
      </div>

      {/* ── Dynamic modals ──────────────────────────────────────────────── */}

      <InsertFieldPanel
        open={showFieldPanel}
        onClose={() => setShowFieldPanel(false)}
        onInsert={handleInsertField}
        schema={schema}
        schemaLoading={schemaLoading}
      />

      <EditorPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        editorData={editorData}
        layoutConfig={layoutConfig}
        templateName={meta.name}
        renderSectionHtml={renderSectionHtml}
      />

      <SignatureUploadModal
        open={showSigUpload}
        onClose={() => { setShowSigUpload(false); setSigEditId(null); setSigEditSection(null); }}
        onInsert={handleInsertUploadedSig}
        initialSrc={sigEditId ? (getSection(sigEditSection || 'body').elements?.find(e => e.id === sigEditId)?.src || null) : null}
      />

      <SignatureDrawModal
        open={showSigDraw}
        onClose={() => { setShowSigDraw(false); setSigEditId(null); setSigEditSection(null); }}
        onInsert={handleInsertDrawnSig}
      />

      {/* ── Version history panel ─────────────────────────────────────── */}
      {showVersionHistory && isEdit && (
        <TemplateVersionHistoryPanel
          templateId={id}
          currentVersion={meta.version}
          hasUnsavedChanges={
            lastSavedEditorDataRef.current !== null &&
            JSON.stringify(editorData) !== lastSavedEditorDataRef.current
          }
          onClose={() => setShowVersionHistory(false)}
          onRestored={handleVersionRestored}
        />
      )}
    </div>
  );
}
