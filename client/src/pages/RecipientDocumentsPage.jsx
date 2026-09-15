/**
 * M-2: Authenticated Recipient area — "My Documents".
 *
 * Shows every document delivered to this recipient's email address.
 * Allows:
 *   - Download (ownership-confirmed documents only)
 *   - Verify integrity (any confirmed delivery)
 * Does NOT grant any generator, approver, or admin capabilities.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { recipientService } from '../services/recipientService';

function StatusBadge({ status }) {
  const map = {
    CONFIRMED: { label: 'Ownership Confirmed', color: '#16a34a' },
    REJECTED:  { label: 'Ownership Rejected',  color: '#dc2626' },
    PENDING:   { label: 'Pending',              color: '#d97706' },
  };
  const s = map[status] || map.PENDING;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: `${s.color}18`,
      color: s.color,
      border: `1px solid ${s.color}44`,
    }}>
      {s.label}
    </span>
  );
}

function VerifyResultBadge({ result }) {
  if (!result) return null;
  const ok = result.verified;
  return (
    <div style={{
      marginTop: 8,
      padding: '8px 12px',
      borderRadius: 8,
      background: ok ? '#dcfce7' : '#fee2e2',
      color: ok ? '#166534' : '#991b1b',
      fontSize: 13,
      border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`,
    }}>
      <strong>{ok ? '✓ Authentic' : '✗ Integrity check failed'}</strong>
      <span style={{ marginLeft: 8 }}>{result.message}</span>
      {result.docId && (
        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>
          Doc ID: {result.docId}
        </div>
      )}
    </div>
  );
}

export default function RecipientDocumentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [downloading, setDownloading] = useState(null); // deliveryId being downloaded
  const [verifying, setVerifying]     = useState(null); // deliveryId being verified
  const [verifyResults, setVerifyResults] = useState({}); // deliveryId → result object

  useEffect(() => {
    recipientService.listMyDeliveries()
      .then((res) => setDeliveries(res.data || []))
      .catch((err) => showToast(err.message || 'Failed to load your documents.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async (deliveryId) => {
    setDownloading(deliveryId);
    try {
      await recipientService.download(deliveryId);
    } catch (err) {
      showToast(err.message || 'Download failed.', 'error');
    } finally {
      setDownloading(null);
    }
  };

  const handleVerify = async (deliveryId) => {
    setVerifying(deliveryId);
    try {
      const res = await recipientService.verify(deliveryId);
      setVerifyResults((prev) => ({ ...prev, [deliveryId]: res.data }));
      showToast(res.data.verified ? 'Document is authentic.' : 'Hash mismatch — document may be tampered.', res.data.verified ? 'success' : 'error');
    } catch (err) {
      showToast(err.message || 'Verification failed.', 'error');
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>My Documents</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Documents delivered to <strong>{user?.email}</strong>
      </p>

      {loading && (
        <div style={{ color: '#6b7280', padding: 32, textAlign: 'center' }}>Loading your documents…</div>
      )}

      {!loading && deliveries.length === 0 && (
        <div style={{
          padding: 48, textAlign: 'center', borderRadius: 12,
          background: '#f9fafb', border: '1px dashed #d1d5db', color: '#6b7280',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No documents yet</div>
          <div style={{ fontSize: 13 }}>
            Documents sent to your email address will appear here once you receive them.
          </div>
        </div>
      )}

      {!loading && deliveries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {deliveries.map((d) => (
            <div key={d.delivery_id} style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{d.template_name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {d.template_category} &bull; Doc ID: <code style={{ fontSize: 11 }}>{d.doc_uuid}</code>
                  </div>
                </div>
                <StatusBadge status={d.ownership_status} />
              </div>

              {/* Date info */}
              <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
                <span>Delivered: {d.delivered_at ? new Date(d.delivered_at).toLocaleDateString() : '—'}</span>
                {d.downloaded_at && <span>Downloaded: {new Date(d.downloaded_at).toLocaleDateString()}</span>}
                {d.doc_status && <span>Status: <strong style={{ textTransform: 'capitalize' }}>{d.doc_status}</strong></span>}
              </div>

              {/* Revoked / deleted notice */}
              {d.revoked_at && (
                <div style={{ marginTop: 10, padding: '6px 12px', background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
                  ⚠ This document has been revoked by the issuing organisation.
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                {d.ownership_status === 'CONFIRMED' && !d.revoked_at && !d.deleted_at && (
                  <button
                    type="button"
                    onClick={() => handleDownload(d.delivery_id)}
                    disabled={downloading === d.delivery_id}
                    style={{
                      padding: '7px 18px', borderRadius: 7, border: 'none',
                      background: '#2563eb', color: '#fff', fontWeight: 600,
                      fontSize: 13, cursor: 'pointer', opacity: downloading === d.delivery_id ? 0.65 : 1,
                    }}
                  >
                    {downloading === d.delivery_id ? 'Downloading…' : '⬇ Download'}
                  </button>
                )}

                {d.ownership_status === 'CONFIRMED' && (
                  <button
                    type="button"
                    onClick={() => handleVerify(d.delivery_id)}
                    disabled={verifying === d.delivery_id}
                    style={{
                      padding: '7px 18px', borderRadius: 7,
                      border: '1px solid #d1d5db', background: '#f9fafb',
                      color: '#374151', fontWeight: 600, fontSize: 13,
                      cursor: 'pointer', opacity: verifying === d.delivery_id ? 0.65 : 1,
                    }}
                  >
                    {verifying === d.delivery_id ? 'Verifying…' : '✓ Verify Integrity'}
                  </button>
                )}
              </div>

              {/* Inline verify result */}
              {verifyResults[d.delivery_id] && (
                <VerifyResultBadge result={verifyResults[d.delivery_id]} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
