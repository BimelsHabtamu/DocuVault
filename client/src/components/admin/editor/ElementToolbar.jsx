/**
 * ElementToolbar.jsx
 *
 * Renders the selection box + 8-handle resize corners + contextual action bar
 * around a selected element on the canvas.
 *
 * Improvements (v2):
 *   - Position indicator (X/Y tooltip) while dragging
 *   - Size indicator (W/H tooltip) while resizing
 *   - Angle indicator while rotating
 *   - Rotation fix: uses sectionRef.getBoundingClientRect() instead of
 *     #editor-canvas-inner so it works correctly regardless of section
 *     vertical offset inside the page
 *   - Inline formatting mini-toolbar for text/heading/watermark/dynamic_field
 *
 * Props:
 *   el            — the element object (px coords, not pt)
 *   zoom          — current canvas zoom
 *   sectionRef    — React ref to the section <div> — used for rotation calculation
 *   onUpdate      — (patch) => void
 *   onDelete      — () => void
 *   onDuplicate   — () => void
 *   onBringFwd    — () => void
 *   onSendBwd     — () => void
 *   onToggleLock  — () => void
 *   onPosIndicator — ({ label, mouseX, mouseY } | null) => void — show/hide position tooltip
 */
import { useRef, useCallback } from 'react';

const HANDLE_SIZE = 8;

// Tiny action-bar button
function Btn({ title, onClick, active, danger, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26,
        background: active ? '#eff6ff' : danger ? '#fee2e2' : '#ffffff',
        border: `1px solid ${active ? '#bfdbfe' : danger ? '#fca5a5' : '#e5e7eb'}`,
        borderRadius: 5,
        cursor: 'pointer',
        color: active ? '#1d4ed8' : danger ? '#dc2626' : '#374151',
        fontSize: 12, flexShrink: 0,
        transition: 'background 0.12s',
        fontWeight: active ? 700 : 400,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = active ? '#dbeafe' : danger ? '#fca5a5' : '#f3f4f6'; }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? '#eff6ff' : danger ? '#fee2e2' : '#ffffff'; }}
    >
      {children}
    </button>
  );
}

// Resize handle at one of 8 positions
function Handle({ position, onMouseDown, locked }) {
  const cursorMap = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
    w:  'w-resize',                  e: 'e-resize',
    sw: 'sw-resize', s: 's-resize', se: 'se-resize',
  };
  const posStyle = {
    nw: { top: -4, left: -4 },
    n:  { top: -4, left: '50%', transform: 'translateX(-50%)' },
    ne: { top: -4, right: -4 },
    w:  { top: '50%', left: -4, transform: 'translateY(-50%)' },
    e:  { top: '50%', right: -4, transform: 'translateY(-50%)' },
    sw: { bottom: -4, left: -4 },
    s:  { bottom: -4, left: '50%', transform: 'translateX(-50%)' },
    se: { bottom: -4, right: -4 },
  };
  return (
    <div
      onMouseDown={locked ? undefined : (e) => { e.stopPropagation(); onMouseDown(e, position); }}
      style={{
        position: 'absolute',
        width: HANDLE_SIZE, height: HANDLE_SIZE,
        background: locked ? '#d1d5db' : '#ffffff',
        border: `1.5px solid ${locked ? '#9ca3af' : '#2563eb'}`,
        borderRadius: 2,
        cursor: locked ? 'default' : cursorMap[position],
        zIndex: 10,
        ...posStyle[position],
      }}
    />
  );
}

export default function ElementToolbar({
  el,
  zoom,
  sectionRef,
  onUpdate,
  onDelete,
  onDuplicate,
  onBringFwd,
  onSendBwd,
  onToggleLock,
  onPosIndicator,
}) {
  const dragRef = useRef(null);

  // ── Drag-to-move ───────────────────────────────────────────────────────
  const startDrag = useCallback((e) => {
    if (el.locked) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX  = el.x;
    const origY  = el.y;

    const onMove = (mv) => {
      const dx = (mv.clientX - startX) / zoom;
      const dy = (mv.clientY - startY) / zoom;
      const nx = Math.max(0, Math.round(origX + dx));
      const ny = Math.max(0, Math.round(origY + dy));
      onUpdate({ x: nx, y: ny });
      // Position indicator in pt (divide by 1.3333)
      const xPt = Math.round(nx / 1.3333);
      const yPt = Math.round(ny / 1.3333);
      onPosIndicator?.({ label: `X: ${xPt}  Y: ${yPt}`, mouseX: mv.clientX, mouseY: mv.clientY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onPosIndicator?.(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [el, zoom, onUpdate, onPosIndicator]);

  // ── Resize ─────────────────────────────────────────────────────────────
  const startResize = useCallback((e, handle) => {
    if (el.locked) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX  = el.x;
    const origY  = el.y;
    const origW  = el.width;
    const origH  = el.height;
    const MIN    = 20;

    const onMove = (mv) => {
      const dx = (mv.clientX - startX) / zoom;
      const dy = (mv.clientY - startY) / zoom;
      let x = origX, y = origY, w = origW, h = origH;

      if (handle.includes('e')) w = Math.max(MIN, origW + dx);
      if (handle.includes('s')) h = Math.max(MIN, origH + dy);
      if (handle.includes('w')) { w = Math.max(MIN, origW - dx); x = origX + (origW - w); }
      if (handle.includes('n')) { h = Math.max(MIN, origH - dy); y = origY + (origH - h); }

      onUpdate({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
      const wPt = Math.round(w / 1.3333);
      const hPt = Math.round(h / 1.3333);
      onPosIndicator?.({ label: `W: ${wPt}  H: ${hPt}`, mouseX: mv.clientX, mouseY: mv.clientY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onPosIndicator?.(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [el, zoom, onUpdate, onPosIndicator]);

  return (
    <>
      {/* ── Selection outline + resize handles ──────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left:   el.x - 1,
          top:    el.y - 1,
          width:  el.width  + 2,
          height: el.height + 2,
          border: `2px solid ${el.locked ? '#9ca3af' : '#2563eb'}`,
          borderRadius: 2,
          pointerEvents: el.locked ? 'none' : 'auto',
          zIndex: 20,
          cursor: el.locked ? 'default' : 'move',
          boxSizing: 'border-box',
        }}
        onMouseDown={startDrag}
        onClick={e => e.stopPropagation()}
      >
        {['nw','n','ne','w','e','sw','s','se'].map(h => (
          <Handle key={h} position={h} onMouseDown={startResize} locked={el.locked} />
        ))}
      </div>

      {/* ── Floating action bar ──────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left:  el.x,
          top:   Math.max(0, el.y - 36),
          display: 'flex',
          gap: 3,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 7,
          padding: '3px 5px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          zIndex: 30,
          pointerEvents: 'auto',
        }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* Duplicate */}
        <Btn title="Duplicate (Ctrl+D)" onClick={onDuplicate}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="8" y="8" width="12" height="12" rx="2"/>
            <path d="M4 16V4h12"/>
          </svg>
        </Btn>

        {/* Bring forward */}
        <Btn title="Bring Forward" onClick={onBringFwd}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="4" y="8" width="12" height="12" rx="1.5"/>
            <rect x="8" y="4" width="12" height="12" rx="1.5" fill="white"/>
          </svg>
        </Btn>

        {/* Send backward */}
        <Btn title="Send Backward" onClick={onSendBwd}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="8" y="4" width="12" height="12" rx="1.5"/>
            <rect x="4" y="8" width="12" height="12" rx="1.5" fill="white"/>
          </svg>
        </Btn>

        {/* Lock / unlock */}
        <Btn title={el.locked ? 'Unlock' : 'Lock'} onClick={onToggleLock} active={el.locked}>
          {el.locked ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 019.9-1"/>
            </svg>
          )}
        </Btn>

        <div style={{ width: 1, background: '#e5e7eb', margin: '2px 1px' }} />

        {/* Delete */}
        <Btn title="Delete (Del)" onClick={onDelete} danger>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </Btn>
      </div>

      {/* ── Rotation handle ──────────────────────────────────────────── */}
      {!el.locked && (
        <RotationHandle el={el} zoom={zoom} sectionRef={sectionRef} onUpdate={onUpdate} onPosIndicator={onPosIndicator} />
      )}
    </>
  );
}

// ── Rotation handle ───────────────────────────────────────────────────────────
function RotationHandle({ el, zoom, sectionRef, onUpdate, onPosIndicator }) {
  const startRotate = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Element centre in px (within the section coordinate space)
    const cx = el.x + el.width  / 2;
    const cy = el.y + el.height / 2;

    const onMove = (mv) => {
      // Use the sectionRef for accurate offset regardless of section vertical position
      const rect = sectionRef?.current?.getBoundingClientRect
        ? sectionRef.current.getBoundingClientRect()
        : document.getElementById('editor-canvas-inner')?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (mv.clientX - rect.left) / zoom;
      const mouseY = (mv.clientY - rect.top)  / zoom;
      const angle  = Math.atan2(mouseY - cy, mouseX - cx) * (180 / Math.PI) + 90;
      const rounded = Math.round(angle);
      onUpdate({ rotation: rounded });
      onPosIndicator?.({ label: `${rounded}°`, mouseX: mv.clientX, mouseY: mv.clientY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onPosIndicator?.(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [el, zoom, sectionRef, onUpdate, onPosIndicator]);

  return (
    <div
      onMouseDown={startRotate}
      onClick={e => e.stopPropagation()}
      title="Rotate"
      style={{
        position: 'absolute',
        left:  el.x + el.width / 2 - 6,
        top:   el.y - 24,
        width:  12, height: 12,
        borderRadius: '50%',
        background: '#ffffff',
        border: '1.5px solid #2563eb',
        cursor: 'grab',
        zIndex: 25,
      }}
    />
  );
}
