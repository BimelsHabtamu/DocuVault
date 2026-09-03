/**
 * SignatureUploadModal.jsx
 *
 * Allows the admin to choose an image file for a "Uploaded Signature" element.
 * The image is uploaded to POST /api/upload/signature which stores it on disk
 * and returns a server URL.  The element's el.src is set to that URL so:
 *   - The canvas renders it immediately
 *   - renderSectionHtml produces <img src="/uploads/signatures/...">
 *   - pdfService.fetchImageAsBase64 reads the local file and embeds it in the PDF
 *
 * Props:
 *   open       boolean
 *   onClose    () => void
 *   onInsert   ({ src, serverUrl, width, height, label, showLabel, labelText }) => void
 *   initialSrc string | null   — pre-fills when replacing an existing image
 */

import { useState, useCallback } from 'react';
import axiosInstance from '../../../api/axiosInstance';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export default function SignatureUploadModal({ open, onClose, onInsert, initialSrc }) {
  const [preview, setPreview]         = useState(initialSrc || null);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState('');
  const [isDragging, setIsDragging]   = useState(false);
  const [width, setWidth]             = useState(160);
  const [height, setHeight]           = useState(60);
  const [keepRatio, setKeepRatio]     = useState(true);
  const [showLabel, setShowLabel]     = useState(true);
  const [labelText, setLabelText]     = useState('Authorised Signature');
  const [pendingFile, setPendingFile] = useState(null);  // File awaiting upload
  const [serverUrl, setServerUrl]     = useState(null);  // URL returned by upload

  // ── Reset state when modal closes ────────────────────────────────────────
  const handleClose = () => {
    setPreview(initialSrc || null);
    setError('');
    setUploading(false);
    setPendingFile(null);
    setServerUrl(null);
    onClose();
  };

  // ── Process a chosen file (client-side validation + preview) ──────────────
  const processFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be smaller than 2 MB.');
      return;
    }
    setError('');
    setPendingFile(file);
    setServerUrl(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e) => processFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  // ── Upload to server ───────────────────────────────────────────────────────
  const uploadToServer = async () => {
    if (!pendingFile) return null;
    const fd = new FormData();
    fd.append('file', pendingFile);
    const res = await axiosInstance.post('/upload/signature', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;   // e.g. '/uploads/signatures/signature-1234.png'
  };

  // ── Insert ─────────────────────────────────────────────────────────────────
  const handleInsert = async () => {
    if (!preview) { setError('Choose an image first.'); return; }
    setError('');
    setUploading(true);
    try {
      let url = serverUrl;
      if (pendingFile) {
        url = await uploadToServer();
        setServerUrl(url);
      }
      // Use the server URL as src so pdfService can resolve it via local file read.
      // If for some reason upload failed we fall back to the base64 preview as src.
      onInsert({
        src:       url  || preview,
        serverUrl: url  || '',
        width,
        height,
        showLabel,
        labelText,
      });
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        width: 480, background: '#ffffff', borderRadius: 14,
        boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Upload Signature</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Image will be embedded in the template and PDF
            </div>
          </div>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto' }}>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? '#2563eb' : preview ? '#86efac' : '#d1d5db'}`,
              borderRadius: 10,
              padding: '20px 16px',
              background: isDragging ? '#eff6ff' : preview ? '#f0fdf4' : '#f9fafb',
              textAlign: 'center',
              transition: 'all 0.15s',
              marginBottom: 16,
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('sig-file-input')?.click()}
          >
            {preview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={preview}
                  alt="Signature preview"
                  style={{
                    maxWidth: '100%', maxHeight: 80,
                    objectFit: 'contain',
                    display: 'block', margin: '0 auto',
                    background: 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 0 0 / 16px 16px',
                    borderRadius: 6, border: '1px solid #d1d5db',
                  }}
                />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setPreview(null); setPendingFile(null); setServerUrl(null); }}
                  style={{
                    position: 'absolute', top: -8, right: -8,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#ef4444', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Drop image here or click to browse
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  PNG, JPG, SVG, WebP — max 2 MB
                </div>
              </>
            )}
            <input
              id="sig-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          {/* Size controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                Width (pt)
              </label>
              <input
                type="number" min={20} max={400}
                value={width}
                onChange={e => {
                  const w = Number(e.target.value);
                  setWidth(w);
                  if (keepRatio) setHeight(Math.round(w * 60 / 160));
                }}
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                Height (pt)
              </label>
              <input
                type="number" min={10} max={200}
                value={height}
                onChange={e => setHeight(Number(e.target.value))}
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, marginBottom: 14, userSelect: 'none' }}>
            <input type="checkbox" checked={keepRatio} onChange={e => setKeepRatio(e.target.checked)} />
            Maintain aspect ratio
          </label>

          {/* Label */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, marginBottom: 8, userSelect: 'none' }}>
            <input type="checkbox" checked={showLabel} onChange={e => setShowLabel(e.target.checked)} />
            Show label below signature
          </label>
          {showLabel && (
            <input
              type="text"
              value={labelText}
              onChange={e => setLabelText(e.target.value)}
              placeholder="e.g. Authorised Signature"
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box', marginBottom: 4 }}
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
            onClick={handleClose}
            style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 500, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!preview || uploading}
            style={{
              flex: 2, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none',
              borderRadius: 8, background: (!preview || uploading) ? '#93c5fd' : '#2563eb',
              color: '#fff', cursor: (!preview || uploading) ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading…' : 'Insert Signature'}
          </button>
        </div>
      </div>
    </div>
  );
}
