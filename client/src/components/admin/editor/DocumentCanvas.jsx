/**
 * DocumentCanvas.jsx
 *
 * A4/Letter page canvas with three editable sections: HEADER, BODY, FOOTER.
 *
 * WPS/Word-style interaction rules:
 *
 *   EMPTY section background click  → create one text element + open inline edit
 *   NON-EMPTY section background click → deselect current element, select section
 *   Click on TEXT / HEADING element → select + immediately enter inline edit
 *   Click on any other element      → select (move/resize via handles)
 *   Drag element selection box      → move element
 *   Drag resize handles             → resize element
 *   Drag rotation handle            → rotate element
 *   Drag from Insert panel          → drop to create element at cursor position
 *   Escape                          → commit inline edit / deselect
 */
import { useRef, useCallback, useState } from 'react';
import ElementRenderer from './ElementRenderer';
import ElementToolbar  from './ElementToolbar';
import { createElement, ELEMENT_TYPES } from '../../../data/templateEditorModel';

// ── Constants ─────────────────────────────────────────────────────────────────
const PT_TO_PX = 1.3333;
const ptToPx = (pt) => pt * PT_TO_PX;
const pxToPt = (px) => Math.round(px / PT_TO_PX);

// Types where a single click immediately opens the inline text editor
const INLINE_EDIT_TYPES = new Set([
  ELEMENT_TYPES.TEXT,
  ELEMENT_TYPES.HEADING,
  ELEMENT_TYPES.WATERMARK,
  ELEMENT_TYPES.DYNAMIC_FIELD,
]);

function getPageDimensions(layoutConfig) {
  const SIZE_MAP = {
    A4:     { w: 595.28, h: 841.89 },
    LETTER: { w: 612,    h: 792    },
  };
  const size = SIZE_MAP[layoutConfig?.pageSize] || SIZE_MAP.A4;
  return layoutConfig?.orientation === 'landscape'
    ? { widthPt: size.h, heightPt: size.w }
    : { widthPt: size.w, heightPt: size.h };
}

// ── Section visual metadata ───────────────────────────────────────────────────
const SECTION_META = {
  header: {
    label: 'HEADER', icon: '▲',
    bg: '#f0f7ff', bgDisabled: '#f8fafc', border: '#bfdbfe',
    labelColor: '#1d4ed8', labelBg: '#eff6ff',
    minHeight: 40, maxHeight: 300,
  },
  body: {
    label: 'BODY', icon: '▪',
    bg: '#ffffff', bgDisabled: '#f9fafb', border: '#e5e7eb',
    labelColor: '#374151', labelBg: '#f3f4f6',
    minHeight: 100, maxHeight: 2000,
  },
  footer: {
    label: 'FOOTER', icon: '▼',
    bg: '#f9fafb', bgDisabled: '#f3f4f6', border: '#e5e7eb',
    labelColor: '#6b7280', labelBg: '#f3f4f6',
    minHeight: 30, maxHeight: 200,
  },
};

// ── Small floating coordinate tooltip shown during drag/resize/rotate ─────────
function PosHint({ x, y, label }) {
  if (!label) return null;
  return (
    <div style={{
      position: 'fixed', left: x + 14, top: y - 30,
      background: 'rgba(15,23,42,0.85)', color: '#fff',
      fontSize: 10, fontWeight: 600, padding: '3px 8px',
      borderRadius: 5, pointerEvents: 'none', zIndex: 9999,
      whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      {label}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({
  name, section, pageWidthPt,
  selectedId, selectedSection, isSectionSelected,
  zoom, showGrid, dragType, editingId,
  onSelect, onSelectSection, onUpdateElement,
  onDeleteElement, onDuplicateElement,
  onBringForward, onSendBackward,
  onDropElement, onUpdateSection,
  onStartInlineEdit, onCommitInlineEdit,
  onClickToType,
}) {
  const sectionRef = useRef(null);
  const resizeRef  = useRef({ active: false });
  const meta       = SECTION_META[name] || SECTION_META.body;

  const heightPt   = section?.height || (name === 'header' ? 80 : name === 'footer' ? 60 : 500);
  const enabled    = section?.enabled !== false;
  const repeatEvery = section?.repeatOnEveryPage !== false;
  const sectionBg  = enabled
    ? (section?.background?.type === 'color' ? section.background.color : meta.bg)
    : meta.bgDisabled;

  const [isDragOver, setIsDragOver] = useState(false);
  const [posHint,    setPosHint]    = useState(null);

  const elements = [...(section?.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const isBody   = name === 'body';
  const isEmpty  = elements.length === 0;

  // ── Section bar click → select section settings ───────────────────────
  const onBarClick = useCallback((e) => {
    e.stopPropagation();
    onSelectSection(name);
  }, [name, onSelectSection]);

  // ── Section canvas background click ──────────────────────────────────
  // Rules:
  //  • If section is EMPTY  → create a text element at click position and edit it
  //  • If section is NOT EMPTY → just select the section (deselect element)
  //  • Never fires if the click was on an element (those call stopPropagation)
  const onBgClick = useCallback((e) => {
    if (!enabled || dragType) return;
    if (e.button !== 0) return;

    // Belt-and-suspenders: only handle direct background clicks
    const isBackground = e.target === sectionRef.current
      || e.target.dataset.sectionCanvas === '1';
    if (!isBackground) return;

    e.stopPropagation();

    if (isEmpty) {
      // Empty section: create a text element and open inline edit
      const rect = sectionRef.current.getBoundingClientRect();
      const xPt  = Math.max(0, pxToPt((e.clientX - rect.left) / zoom));
      const yPt  = Math.max(0, pxToPt((e.clientY - rect.top)  / zoom));
      onClickToType(name, xPt, yPt);
    } else {
      // Non-empty section: deselect element, show section settings
      onSelectSection(name);
    }
  }, [enabled, dragType, isEmpty, name, zoom, onClickToType, onSelectSection]);

  // ── Drag-and-drop from Insert panel ──────────────────────────────────
  const onDragOver = useCallback((e) => {
    if (!dragType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, [dragType]);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const onDrop = useCallback((e) => {
    if (!dragType) return;
    e.preventDefault();
    setIsDragOver(false);
    const rect = sectionRef.current.getBoundingClientRect();
    const xPt  = Math.max(0, Math.round((e.clientX - rect.left) / zoom / PT_TO_PX));
    const yPt  = Math.max(0, Math.round((e.clientY - rect.top)  / zoom / PT_TO_PX));
    onDropElement(name, dragType, xPt, yPt);
  }, [dragType, name, zoom, onDropElement]);

  // ── Section height resize (drag handle at bottom) ─────────────────────
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { active: true, startY: e.clientY, startH: heightPt };

    const onMove = (me) => {
      if (!resizeRef.current.active) return;
      const delta = pxToPt((me.clientY - resizeRef.current.startY) / zoom);
      const newH  = Math.max(meta.minHeight, Math.min(meta.maxHeight, resizeRef.current.startH + delta));
      onUpdateSection(name, { height: newH });
    };
    const onUp = () => {
      resizeRef.current.active = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [heightPt, meta, name, zoom, onUpdateSection]);

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Section label bar ─────────────────────────────────────── */}
      <div
        onClick={onBarClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 6px 3px 4px',
          background: isSectionSelected ? meta.labelBg : 'transparent',
          borderRadius: '4px 4px 0 0',
          cursor: 'pointer',
          borderLeft: isSectionSelected ? `3px solid ${meta.labelColor}` : '3px solid transparent',
          transition: 'background 0.1s', userSelect: 'none',
        }}
        onMouseEnter={e => { if (!isSectionSelected) e.currentTarget.style.background = meta.labelBg; }}
        onMouseLeave={e => { if (!isSectionSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', color: meta.labelColor, textTransform: 'uppercase' }}>
          {meta.icon} {meta.label}
        </span>

        {/* Enable/disable toggle */}
        <div
          title={enabled ? `Disable ${name}` : `Enable ${name}`}
          onClick={(e) => { e.stopPropagation(); onUpdateSection(name, { enabled: !enabled }); }}
          style={{
            width: 28, height: 14, borderRadius: 7, flexShrink: 0,
            background: enabled ? meta.labelColor : '#d1d5db',
            position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          <div style={{
            position: 'absolute', top: 2, left: enabled ? 15 : 2,
            width: 10, height: 10, borderRadius: '50%',
            background: '#fff', transition: 'left 0.15s',
          }} />
        </div>

        {/* Repeat badge — header/footer only */}
        {!isBody && (
          <div
            onClick={(e) => { e.stopPropagation(); onUpdateSection(name, { repeatOnEveryPage: !repeatEvery }); }}
            style={{
              padding: '1px 5px', borderRadius: 3, cursor: 'pointer',
              fontSize: 7, fontWeight: 700, letterSpacing: '0.04em',
              background: repeatEvery ? '#dcfce7' : '#fef9c3',
              color:      repeatEvery ? '#15803d' : '#92400e',
              border:     repeatEvery ? '1px solid #86efac' : '1px solid #fcd34d',
              userSelect: 'none', flexShrink: 0,
            }}
          >
            {repeatEvery ? '↻ All Pages' : '① First Page'}
          </div>
        )}

        {isBody && (
          <div style={{
            padding: '1px 5px', borderRadius: 3, fontSize: 7, fontWeight: 700,
            background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
            userSelect: 'none', flexShrink: 0,
          }}>
            ↕ Flows Across Pages
          </div>
        )}

        <div style={{ flex: 1, height: 1, background: meta.border, marginLeft: 4 }} />
        <span style={{ fontSize: 8, color: '#9ca3af', userSelect: 'none', flexShrink: 0 }}>
          {elements.length} el{elements.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 8, color: '#c4c9d4', userSelect: 'none', flexShrink: 0 }}>
          {heightPt}pt
        </span>
      </div>

      {/* ── Canvas ────────────────────────────────────────────────── */}
      <div
        ref={sectionRef}
        data-section-canvas="1"
        onClick={onBgClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          position: 'relative',
          width:    ptToPx(pageWidthPt),
          height:   ptToPx(heightPt),
          background: sectionBg,
          border:    `1px solid ${isSectionSelected ? meta.labelColor : isDragOver ? '#60a5fa' : meta.border}`,
          borderTop: `${isSectionSelected ? 2 : 1}px solid ${isSectionSelected ? meta.labelColor : isDragOver ? '#60a5fa' : meta.border}`,
          overflow: 'hidden',
          // Cursor: text when empty (invites typing), default otherwise
          cursor: dragType ? 'copy' : (enabled && isEmpty ? 'text' : 'default'),
          opacity: enabled ? 1 : 0.45,
          boxSizing: 'border-box',
          backgroundImage: showGrid && enabled
            ? 'linear-gradient(rgba(99,102,241,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.07) 1px,transparent 1px)'
            : 'none',
          backgroundSize: showGrid ? `${ptToPx(10)}px ${ptToPx(10)}px` : 'auto',
        }}
      >
        {/* Disabled overlay */}
        {!enabled && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(249,250,251,0.6)', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, background: '#f3f4f6', padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              {meta.label} disabled
            </span>
          </div>
        )}

        {/* Drag-over overlay */}
        {isDragOver && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 90,
            background: 'rgba(59,130,246,0.06)', border: '2px dashed #60a5fa',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, background: '#eff6ff', padding: '4px 12px', borderRadius: 6 }}>
              Drop into {meta.label}
            </span>
          </div>
        )}

        {/* Empty-state hint */}
        {enabled && isEmpty && !dragType && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, zIndex: 1,
          }}>
            <span style={{ fontSize: 12, color: '#c4c9d4', fontWeight: 500 }}>
              Click to type, or drag an element from the Insert panel
            </span>
          </div>
        )}

        {/* Position/size/angle hint during drag */}
        {posHint && <PosHint x={posHint.mouseX} y={posHint.mouseY} label={posHint.label} />}

        {/* ── Elements ──────────────────────────────────────────── */}
        {elements.map(el => {
          const isSelected    = selectedId === el.id && selectedSection === name;
          const isEditing     = editingId === el.id;
          const canEdit       = INLINE_EDIT_TYPES.has(el.type);

          return (
            <div key={el.id} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>

              {/* ── Element visual ──────────────────────────────── */}
              <div
                onMouseDown={(e) => {
                  if (el.locked) return;
                  // Stop propagation so background click handlers don't fire
                  e.stopPropagation();
                  if (isEditing) return;
                  onSelect(el.id, name);
                  if (canEdit) {
                    // Open inline editor on the next tick so React has processed
                    // the select state update first
                    setTimeout(() => onStartInlineEdit(name, el.id), 0);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left:   ptToPx(el.x),
                  top:    ptToPx(el.y),
                  width:  ptToPx(el.width),
                  height: ptToPx(el.height),
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  opacity: el.visible === false ? 0.25 : (el.opacity ?? 1),
                  zIndex:  isEditing ? 60 : (el.zIndex || 0),
                  cursor:  el.locked ? 'default' : isEditing ? 'text' : canEdit ? 'text' : 'move',
                  boxSizing: 'border-box',
                  // Dashed hover outline (only when not selected)
                  outline: 'none',
                  outlineOffset: '2px',
                }}
                onMouseEnter={e => {
                  if (!isSelected && !el.locked && !isEditing) {
                    e.currentTarget.style.outline = '1.5px dashed #60a5fa';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.outline = 'none';
                }}
              >
                <ElementRenderer
                  el={el}
                  isSelected={isSelected}
                  editingId={editingId}
                  onCommitEdit={(val) => {
                    const field = el.type === ELEMENT_TYPES.DYNAMIC_FIELD ? 'placeholder'
                                : el.type === ELEMENT_TYPES.WATERMARK      ? 'text'
                                : 'content';
                    onCommitInlineEdit(name, el.id, val, field);
                  }}
                  onCancelEdit={() => {
                    const field = el.type === ELEMENT_TYPES.DYNAMIC_FIELD ? 'placeholder'
                                : el.type === ELEMENT_TYPES.WATERMARK      ? 'text'
                                : 'content';
                    const orig  = el.type === ELEMENT_TYPES.DYNAMIC_FIELD ? (el.placeholder ?? '')
                                : el.type === ELEMENT_TYPES.WATERMARK      ? (el.text ?? '')
                                : (el.content ?? '');
                    onCommitInlineEdit(name, el.id, orig, field);
                  }}
                />
              </div>

              {/* ── Selection toolbar (handles + action bar) ────── */}
              {isSelected && !isEditing && (
                <ElementToolbar
                  el={{
                    ...el,
                    x:      ptToPx(el.x),
                    y:      ptToPx(el.y),
                    width:  ptToPx(el.width),
                    height: ptToPx(el.height),
                  }}
                  zoom={zoom}
                  sectionRef={sectionRef}
                  onUpdate={(patch) => {
                    const pt = {};
                    if (patch.x      != null) pt.x      = Math.round(patch.x      / PT_TO_PX);
                    if (patch.y      != null) pt.y      = Math.round(patch.y      / PT_TO_PX);
                    if (patch.width  != null) pt.width  = Math.round(patch.width  / PT_TO_PX);
                    if (patch.height != null) pt.height = Math.round(patch.height / PT_TO_PX);
                    for (const [k, v] of Object.entries(patch)) {
                      if (!['x','y','width','height'].includes(k)) pt[k] = v;
                    }
                    onUpdateElement(name, el.id, pt);
                  }}
                  onPosIndicator={setPosHint}
                  onDelete={()      => onDeleteElement(name, el.id)}
                  onDuplicate={()   => onDuplicateElement(name, el.id)}
                  onBringFwd={()    => onBringForward(name, el.id)}
                  onSendBwd={()     => onSendBackward(name, el.id)}
                  onToggleLock={()  => onUpdateElement(name, el.id, { locked: !el.locked })}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Section height drag-handle ─────────────────────────── */}
      <div
        onMouseDown={onResizeStart}
        title={`Drag to resize ${name} (${heightPt}pt)`}
        style={{
          width: ptToPx(pageWidthPt), height: 6,
          cursor: 'row-resize', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 10,
        }}
        onMouseEnter={e => { const b = e.currentTarget.querySelector('.rbar'); if (b) { b.style.background = meta.labelColor; b.style.opacity = '0.6'; } }}
        onMouseLeave={e => { const b = e.currentTarget.querySelector('.rbar'); if (b) { b.style.background = '#d1d5db'; b.style.opacity = '0.35'; } }}
      >
        <div className="rbar" style={{ width: 40, height: 3, borderRadius: 2, background: '#d1d5db', opacity: 0.35, transition: 'background 0.15s, opacity 0.15s', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

// ── Section divider line ──────────────────────────────────────────────────────
function SectionDivider({ section, position }) {
  const isHeaderBody  = position === 'header-body';
  const cfg           = isHeaderBody ? section?.borderBottom : section?.borderTop;
  if (cfg?.show === false) return <div style={{ height: 4 }} />;
  const style = cfg?.style || (isHeaderBody ? 'solid' : 'dashed');
  const width = cfg?.width || 1;
  const color = cfg?.color || (isHeaderBody ? '#3b5bdb' : '#d1d5db');
  return (
    <div style={{ height: 8, display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1, borderTop: `${width}px ${style} ${color}` }} />
    </div>
  );
}

// ── DocumentCanvas (root) ─────────────────────────────────────────────────────
export default function DocumentCanvas({
  editorData, layoutConfig,
  selectedId, selectedSection, editingId,
  onSelect, onSelectSection, onDeselect,
  onUpdateElement, onDeleteElement, onDuplicateElement,
  onBringForward, onSendBackward,
  onUpdateSection, onDropElement,
  onStartInlineEdit, onCommitInlineEdit, onAddElement,
  onClickToType,
  zoom, showGrid, dragType,
}) {
  const { widthPt } = getPageDimensions(layoutConfig);
  const bg = layoutConfig?.background;

  const shared = {
    pageWidthPt: widthPt, selectedId, selectedSection, editingId: editingId ?? null,
    zoom, showGrid, dragType,
    onSelect,
    onSelectSection:    onSelectSection    || (() => {}),
    onUpdateElement,
    onDeleteElement,
    onDuplicateElement,
    onBringForward,
    onSendBackward,
    onDropElement,
    onUpdateSection:    onUpdateSection    || (() => {}),
    onStartInlineEdit:  onStartInlineEdit  || (() => {}),
    onCommitInlineEdit: onCommitInlineEdit || (() => {}),
    onClickToType:      onClickToType      || (() => {}),
  };

  const marginTop    = ptToPx(layoutConfig?.margins?.top    || 40);
  const marginRight  = ptToPx(layoutConfig?.margins?.right  || 40);
  const marginBottom = ptToPx(layoutConfig?.margins?.bottom || 60);
  const marginLeft   = ptToPx(layoutConfig?.margins?.left   || 40);

  return (
    <div
      id="editor-canvas-inner"
      onClick={(e) => { if (e.target === e.currentTarget) onDeselect?.(); }}
      style={{
        background: bg?.type === 'color' ? (bg.color || '#ffffff') : '#ffffff',
        backgroundImage: bg?.type === 'image' && bg.imageUrl ? `url(${bg.imageUrl})` : 'none',
        backgroundSize: 'cover',
        width:  ptToPx(widthPt),
        padding: `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,
        boxSizing: 'border-box',
        boxShadow: '0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      {/* Margin guide lines */}
      <div style={{
        position: 'absolute',
        top: marginTop, left: marginLeft, right: marginRight, bottom: marginBottom,
        border: '1px dashed rgba(99,102,241,0.12)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <Section name="header" section={editorData?.header}
        isSectionSelected={selectedSection === 'header' && !selectedId} {...shared} />

      <SectionDivider section={editorData?.header} position="header-body" />

      <Section name="body" section={editorData?.body}
        isSectionSelected={selectedSection === 'body' && !selectedId} {...shared} />

      <SectionDivider section={editorData?.footer} position="body-footer" />

      <Section name="footer" section={editorData?.footer}
        isSectionSelected={selectedSection === 'footer' && !selectedId} {...shared} />
    </div>
  );
}
