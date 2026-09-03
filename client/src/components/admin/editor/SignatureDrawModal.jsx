/**
 * SignatureDrawModal.jsx
 *
 * A freehand signature drawing pad with:
 *   - Mouse, touch, and stylus (pointer events) support
 *   - Stroke-based undo / redo
 *   - Clear button
 *   - Exports a transparent-background PNG as a base64 data URI
 *   - Configurable pen color and thickness
 *
 * On save the component calls:
 *   onInsert({ src: 'data:image/png;base64,...', width, height, showLabel, labelText })
 *
 * The base64 data URI is stored on the element's el.src.
 * pdfService.fetchImageAsBase64 handles data: URIs directly so the PNG
 * is embedded in the PDF without any additional server upload.
 *
 * Props:
 *   open       boolean
 *   onClose    () => void
 *   onInsert   ({ src, width, height, showLabel, labelText }) => void
 */

import { useRef, useState, useEffect, useCallback } from 'react';

const CANVAS_W = 480;
const CANVAS_H = 200;
const DEFAULT_COLOR    = '#000000';
const DEFAULT_THICKNESS = 2.5;

export default function SignatureDrawModal({ open, onClose, onInsert }) {
  const canvasRef    = useRef(null);
  const isDrawing    = useRef(false);
  const lastPoint    = useRef(null);
  // strokeHistory[i] is an ImageData snapshot taken just before stroke i was drawn.
  // Undo restores the previous snapshot; redo re-draws the next one.
  const history      = useRef([]);   // array of ImageData (before each stroke)
  const redoStack    = useRef([]);   // strokes undone but not yet committed

  const [penColor, setPenColor]       = useState(DEFAULT_COLOR);
  const [penThick, setPenThick]       = useState(DEFAULT_THICKNESS);
  const [hasContent, setHasContent]   = useState(false);
  const [canUndo, setCanUndo]         = useState(false);
  const [canRedo, setCanRedo]         = useState(false);
  const [width, setWidth]             = useState(160);
  const [height, setHeight]           = useState(60);
  const [showLabel, setShowLabel]     = useState(false);
  const [labelText, setLabelText]     = useState('Signature');

  // ── Initialise canvas when the modal opens ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    history.current  = [];
    redoStack.current = [];
    setHasContent(false);
    setCanUndo(false);
    setCanRedo(false);
  }, [open]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext('2d');

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  };

  const snapshotBeforeStroke = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    history.current.push(snap);
    redoStack.current = [];       // new stroke clears redo history
    setCanRedo(false);
    setCanUndo(true);
  };

  // ── Pointer events (handles mouse, touch, stylus uniformly) ───────────────
  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    isDrawing.current = true;
    const pt = getPoint(e);
    lastPoint.current = pt;
    snapshotBeforeStroke();
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth   = penThick;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, [penColor, penThick]);

  const onPointerMove = useCallback((e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pt = getPoint(e);
    // Smooth with quadratic bezier for a natural line
    const midX = (lastPoint.current.x + pt.x) / 2;
    const midY = (lastPoint.current.y + pt.y) / 2;
    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
    ctx.stroke();
    lastPoint.current = pt;
    setHasContent(true);
  }, []);

  const onPointerUp = useCallback((e) => {
    e.preventDefault();
    isDrawing.current = false;
    const ctx = getCtx();
    if (ctx) ctx.closePath();
  }, []);

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleClear = () => {
    const ctx = getCtx();
    if (!ctx) return;
    snapshotBeforeStroke();
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setHasContent(false);
  };

  const handleUndo = () => {
    const ctx = getCtx();
    if (!ctx || !history.current.length) return;
    // Save current state for redo
    const current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    redoStack.current.push(current);
    // Restore previous snapshot
    const prev = history.current.pop();
    ctx.putImageData(prev, 0, 0);
    setCanUndo(history.current.length > 0);
    setCanRedo(true);
    // Check if canvas is now blank
    const data = prev.data;
    const blank = !data.some(v => v !== 0);
    setHasContent(!blank);
  };

  const handleRedo = () => {
    const ctx = getCtx();
    if (!ctx || !redoStack.current.length) return;
    const current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    history.current.push(current);
    const next = redoStack.current.pop();
    ctx.putImageData(next, 0, 0);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    setHasContent(true);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Crop to the bounding box of drawn content to remove empty whitespace
    const ctx   = getCtx();
    const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const { data } = imgData;

    let minX = CANVAS_W, minY = CANVAS_H, maxX = 0, maxY = 0;
    for (let y = 0; y < CANVAS_H; y++) {
      for (let x = 0; x < CANVAS_W; x++) {
        const alpha = data[(y * CANVAS_W + x) * 4 + 3];
        if (alpha > 10) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // If canvas is blank, minX > maxX — export full canvas
    if (minX > maxX) {
      minX = 0; minY = 0; maxX = CANVAS_W - 1; maxY = CANVAS_H - 1;
    }

    const pad = 8; // small padding around the drawing
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(CANVAS_W, maxX + pad) - cropX;
    const cropH = Math.min(CANVAS_H, maxY + pad) - cropY;

    // Draw cropped region on a smaller off-screen canvas to reduce file size
    const offscreen = document.createElement('canvas');
    offscreen.width  = cropW;
    offscreen.height = cropH;
    const offCtx = offscreen.getContext('2d');
    // Transparent background — no fill
    offCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const dataUrl = offscreen.toDataURL('image/png');

    onInsert({
      src:       dataUrl,
      width,
      height,
      showLabel,
      labelText,
    });
    onClose();
  };

  if (!open) return null;

  const ctrlBtn = (label, onClick, disabled, title, accent) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '5px 12px', fontSize: 12, fontWeight: 500,
        border: `1px solid ${accent ? '#2563eb' : '#d1d5db'}`,
        borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer',
        background: accent ? '#eff6ff' : '#f9fafb',
        color: disabled ? '#d1d5db' : accent ? '#1d4ed8' : '#374151',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  );

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
        width: 540, background: '#ffffff', borderRadius: 14,
        boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Draw Signature</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Draw using mouse, touch, or stylus
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20 }}>✕</button>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '10px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa',
        }}>
          {/* Pen colour */}
          <label title="Pen colour" style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Colour</span>
            <input
              type="color"
              value={penColor}
              onChange={e => setPenColor(e.target.value)}
              style={{ width: 28, height: 24, padding: 0, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}
            />
          </label>

          {/* Pen thickness */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Thickness</span>
            <input
              type="range" min={1} max={8} step={0.5}
              value={penThick}
              onChange={e => setPenThick(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 24 }}>{penThick}</span>
          </label>

          <div style={{ flex: 1 }} />

          {ctrlBtn('Undo', handleUndo, !canUndo, 'Undo last stroke')}
          {ctrlBtn('Redo', handleRedo, !canRedo, 'Redo')}
          {ctrlBtn('Clear', handleClear, false, 'Clear canvas')}
        </div>

        {/* Canvas */}
        <div style={{ padding: '0 20px', marginTop: 16, marginBottom: 8 }}>
          <div style={{
            border: '1.5px solid #d1d5db', borderRadius: 8,
            overflow: 'hidden', cursor: 'crosshair',
            // Checkerboard background to make transparent areas visible
            background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 0 0 / 20px 20px',
          }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ display: 'block', width: '100%', touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
          <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 5 }}>
            Draw your signature above. The background will be transparent in the PDF.
          </p>
        </div>

        {/* Output size + label */}
        <div style={{ padding: '0 20px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Width (pt)</label>
            <input
              type="number" min={20} max={400}
              value={width}
              onChange={e => setWidth(Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Height (pt)</label>
            <input
              type="number" min={10} max={200}
              value={height}
              onChange={e => setHeight(Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ padding: '0 20px 16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, marginBottom: 8, userSelect: 'none' }}>
            <input type="checkbox" checked={showLabel} onChange={e => setShowLabel(e.target.checked)} />
            Show label below signature
          </label>
          {showLabel && (
            <input
              type="text"
              value={labelText}
              onChange={e => setLabelText(e.target.value)}
              placeholder="e.g. Signature"
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '14px 20px',
          borderTop: '1px solid #e5e7eb', background: '#f9fafb',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 500, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasContent}
            style={{
              flex: 2, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none',
              borderRadius: 8, background: !hasContent ? '#93c5fd' : '#2563eb',
              color: '#fff', cursor: !hasContent ? 'not-allowed' : 'pointer',
            }}
          >
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}
