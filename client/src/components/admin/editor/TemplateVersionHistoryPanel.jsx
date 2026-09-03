/**
 * TemplateVersionHistoryPanel.jsx
 *
 * Slide-in panel (right side) that shows the full version history for the
 * template currently open in the editor.
 *
 * Features:
 *   - Lists every version (current live + all snapshots), newest first
 *   - Shows who saved it, when, and the template name at that point
 *   - "View" button fetches the full snapshot and shows a concise diff summary
 *     (element count per section, watermark, description changes)
 *   - "Restore" button calls POST /templates/:id/restore/:version with a
 *     confirmation dialog — restoring creates a new version and reloads the editor
 *   - Current version is highlighted and cannot be restored (it's already live)
 *   - Unsaved-changes warning shown when the editor has pending changes
 *
 * Props:
 *   templateId      number | string  — the template being edited
 *   currentVersion  number           — the version number currently in the editor
 *   hasUnsavedChanges boolean        — true when editor state differs from last save
 *   onClose         () => void
 *   onRestored      (newVersion: number) => void  — called after a successful restore
 */

import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../../api/axiosInstance';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function elementCount(editorData, section) {
  try {
    const d = typeof editorData === 'string' ? JSON.parse(editorData) : editorData;
    return (d?.[section]?.elements?.length) ?? 0;
  } catch { return 0; }
}

// ── Diff summary between two version snapshots ────────────────────────────────
// Produces a short list of human-readable change bullets.
function buildDiffSummary(snap, current) {
  if (!snap || !current) return [];
  const lines = [];

  if (snap.name !== current.name)
    lines.push(`Name: "${current.name}" → "${snap.name}"`);
  if (snap.description !== current.description)
    lines.push(`Description changed`);
  if (snap.category !== current.category)
    lines.push(`Category: ${current.category} → ${snap.category}`);
  if (snap.watermark_text !== current.watermark_text)
    lines.push(`Watermark: "${current.watermark_text || '—'}" → "${snap.watermark_text || '—'}"`);

  for (const sec of ['header', 'body', 'footer']) {
    const snapCount    = elementCount(snap.editor_data,    sec);
    const currentCount = elementCount(current.editor_data, sec);
    if (snapCount !== currentCount) {
      lines.push(`${sec.charAt(0).toUpperCase() + sec.slice(1)}: ${currentCount} → ${snapCount} elements`);
    }
  }

  if (lines.length === 0) lines.push('No structural changes detected');
  return lines;
}

// ── Version row ───────────────────────────────────────────────────────────────
function VersionRow({
  entry,
  isCurrent,
  isExpanded,
  isRestoring,
  snapContent,
  snapLoading,
  currentSnap,
  onToggleExpand,
  onRestore,
}) {
  const diff = isExpanded && snapContent && currentSnap
    ? buildDiffSummary(snapContent, currentSnap)
    : [];

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${isCurrent ? '#bfdbfe' : '#e5e7eb'}`,
      background: isCurrent ? '#eff6ff' : '#ffffff',
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* Row header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        cursor: 'pointer',
      }}
        onClick={onToggleExpand}
      >
        {/* Version badge */}
        <span style={{
          minWidth: 36, padding: '2px 6px',
          borderRadius: 6, textAlign: 'center',
          fontSize: 11, fontWeight: 800,
          background: isCurrent ? '#2563eb' : '#f3f4f6',
          color:      isCurrent ? '#ffffff' : '#374151',
          flexShrink: 0,
        }}>
          v{entry.version}
        </span>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: '#111827',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.name}
            {isCurrent && (
              <span style={{
                marginLeft: 6, fontSize: 9, fontWeight: 700,
                color: '#2563eb', background: '#dbeafe',
                padding: '1px 5px', borderRadius: 3,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                current
              </span>
            )}
          </div>
          <div style={{ fontSize: 9.5, color: '#9ca3af', marginTop: 1 }}>
            {formatDate(entry.created_at)}
            {entry.created_by_name ? ` · ${entry.created_by_name}` : ''}
          </div>
        </div>

        {/* Expand chevron */}
        <span style={{
          fontSize: 10, color: '#9ca3af', flexShrink: 0,
          transition: 'transform 0.15s',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>▼</span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{
          padding: '0 12px 12px',
          borderTop: '1px solid #e5e7eb',
        }}>
          {snapLoading ? (
            <div style={{ fontSize: 11, color: '#9ca3af', padding: '8px 0' }}>
              Loading snapshot…
            </div>
          ) : (
            <>
              {/* Diff bullets */}
              {!isCurrent && (
                <div style={{ marginTop: 8, marginBottom: 10 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
                  }}>
                    Changes vs current
                  </div>
                  {diff.map((line, i) => (
                    <div key={i} style={{
                      fontSize: 10.5, color: '#374151',
                      display: 'flex', alignItems: 'flex-start', gap: 5,
                      marginBottom: 3,
                    }}>
                      <span style={{ color: '#6366f1', flexShrink: 0 }}>•</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {/* Section element counts */}
              {snapContent && (
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 10,
                }}>
                  {['header', 'body', 'footer'].map(sec => (
                    <div key={sec} style={{
                      flex: 1, textAlign: 'center',
                      padding: '4px 0',
                      background: '#f9fafb', borderRadius: 5,
                      border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {sec}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                        {elementCount(snapContent.editor_data, sec)}
                      </div>
                      <div style={{ fontSize: 8, color: '#9ca3af' }}>elements</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Restore button — only for non-current versions */}
              {!isCurrent && (
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={e => { e.stopPropagation(); onRestore(); }}
                  style={{
                    width: '100%',
                    padding: '7px 0',
                    fontSize: 12, fontWeight: 600,
                    border: '1.5px solid #6366f1',
                    borderRadius: 7,
                    background: isRestoring ? '#e0e7ff' : '#eef2ff',
                    color: isRestoring ? '#9ca3af' : '#4f46e5',
                    cursor: isRestoring ? 'not-allowed' : 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isRestoring) e.currentTarget.style.background = '#e0e7ff'; }}
                  onMouseLeave={e => { if (!isRestoring) e.currentTarget.style.background = '#eef2ff'; }}
                >
                  {isRestoring ? 'Restoring…' : `↩ Restore v${entry.version}`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function TemplateVersionHistoryPanel({
  templateId,
  currentVersion,
  hasUnsavedChanges,
  onClose,
  onRestored,
}) {
  const [versions,   setVersions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [expanded,   setExpanded]   = useState(null);     // version number
  const [snapCache,  setSnapCache]  = useState({});       // version → full content
  const [snapLoading,setSnapLoading]= useState(null);     // version number being fetched
  const [restoring,  setRestoring]  = useState(null);     // version number being restored
  const [confirmVer, setConfirmVer] = useState(null);     // version number awaiting confirm

  // The "current" snapshot for diffing — always the live version content
  const currentSnap = snapCache[currentVersion] || null;

  // ── Fetch version list ────────────────────────────────────────────────────
  const fetchVersions = useCallback(() => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    axiosInstance.get(`/templates/${templateId}/versions`)
      .then(r => setVersions(r.data || []))
      .catch(e => setError(e.response?.data?.message || 'Failed to load version history'))
      .finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  // ── Fetch snapshot content (lazy) ─────────────────────────────────────────
  const fetchSnap = useCallback((version) => {
    if (!templateId || snapCache[version]) return;
    setSnapLoading(version);
    axiosInstance.get(`/templates/${templateId}/versions/${version}`)
      .then(r => setSnapCache(prev => ({ ...prev, [version]: r.data })))
      .catch(() => {})
      .finally(() => setSnapLoading(null));
  }, [templateId, snapCache]);

  // ── Toggle row expand ─────────────────────────────────────────────────────
  const handleToggle = useCallback((version) => {
    setExpanded(prev => {
      const next = prev === version ? null : version;
      if (next !== null) fetchSnap(next);
      // Always fetch the current version too so we can diff
      fetchSnap(currentVersion);
      return next;
    });
  }, [fetchSnap, currentVersion]);

  // ── Restore flow ──────────────────────────────────────────────────────────
  const handleRestoreConfirm = useCallback(async () => {
    if (!confirmVer) return;
    setRestoring(confirmVer);
    setConfirmVer(null);
    try {
      const res = await axiosInstance.post(`/templates/${templateId}/restore/${confirmVer}`);
      onRestored?.(res.data.newVersion);
      fetchVersions();
    } catch (e) {
      alert(e.response?.data?.message || 'Restore failed');
    } finally {
      setRestoring(null);
    }
  }, [confirmVer, templateId, onRestored, fetchVersions]);

  return (
    <>
      {/* ── Backdrop ────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.15)',
        }}
      />

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 340,
        zIndex: 501,
        background: '#ffffff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Version History
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
              Current: v{currentVersion}
              {versions.length > 0 && ` · ${versions.length} total`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: 18, lineHeight: 1,
              padding: 4, borderRadius: 5,
            }}
          >
            ✕
          </button>
        </div>

        {/* Unsaved changes warning */}
        {hasUnsavedChanges && (
          <div style={{
            padding: '8px 16px',
            background: '#fef9c3',
            borderBottom: '1px solid #fde68a',
            fontSize: 11, color: '#92400e',
            display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13 }}>⚠️</span>
            You have unsaved changes. Save before restoring to avoid losing them.
          </div>
        )}

        {/* Restore confirmation dialog */}
        {confirmVer !== null && (
          <div style={{
            padding: '12px 16px',
            background: '#fef2f2',
            borderBottom: '1px solid #fecaca',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>
              Restore v{confirmVer}?
            </div>
            <div style={{ fontSize: 11, color: '#7f1d1d', marginBottom: 10, lineHeight: 1.5 }}>
              The current v{currentVersion} will be snapshotted first.
              A new v{currentVersion + 1} will be created with the v{confirmVer} content.
              Previously generated documents are not affected.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmVer(null)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 6,
                  border: '1px solid #d1d5db', background: '#fff',
                  cursor: 'pointer', color: '#374151',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestoreConfirm}
                style={{
                  flex: 2, padding: '6px 0', fontSize: 11, fontWeight: 700, borderRadius: 6,
                  border: 'none', background: '#dc2626',
                  cursor: 'pointer', color: '#fff',
                }}
              >
                Yes, restore v{confirmVer} → v{currentVersion + 1}
              </button>
            </div>
          </div>
        )}

        {/* Version list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 12 }}>
              Loading history…
            </div>
          )}
          {error && (
            <div style={{
              padding: '12px', borderRadius: 8,
              background: '#fef2f2', border: '1px solid #fecaca',
              fontSize: 11, color: '#dc2626',
            }}>
              {error}
              <button
                type="button"
                onClick={fetchVersions}
                style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && versions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 11 }}>
              No version history yet.
            </div>
          )}
          {!loading && versions.map(entry => (
            <VersionRow
              key={entry.version}
              entry={entry}
              isCurrent={entry.is_current === true}
              isExpanded={expanded === entry.version}
              isRestoring={restoring === entry.version}
              snapContent={snapCache[entry.version] || null}
              snapLoading={snapLoading === entry.version}
              currentSnap={currentSnap}
              onToggleExpand={() => handleToggle(entry.version)}
              onRestore={() => setConfirmVer(entry.version)}
            />
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid #e5e7eb',
          flexShrink: 0,
          fontSize: 10, color: '#9ca3af', lineHeight: 1.5,
        }}>
          Restoring a version creates a new version — it never overwrites existing
          generated documents. Document A (generated from v1) always references v1.
        </div>
      </div>
    </>
  );
}
