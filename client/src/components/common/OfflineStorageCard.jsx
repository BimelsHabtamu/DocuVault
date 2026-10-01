/**
 * OfflineStorageCard — "what DocuVault is keeping on this device".
 *
 * Every successful GET is written to IndexedDB so the app keeps working without
 * a connection. That data stays on the device, so users get to see how much of
 * it there is, when it was last refreshed, and to delete it on the spot —
 * either the whole store or just the current screen's copy.
 */

import { useCallback, useEffect, useState } from 'react';
import { useOfflineCache, formatBytes } from '../../hooks/useOfflineCache';
import { useToast } from '../../hooks/useToast';

function lastSyncLabel(ts) {
  if (!ts) return 'never';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function OfflineStorageCard() {
  const { showToast } = useToast();
  const { available, stats, isClearing, refresh, clear } = useOfflineCache();
  const [confirming, setConfirming] = useState(false);

  // Coming back online replaces whatever was cached, so the numbers move.
  useEffect(() => {
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, [refresh]);

  const handleClear = useCallback(async () => {
    await clear();
    setConfirming(false);
    showToast('Offline data cleared from this device.', 'success');
  }, [clear, showToast]);

  return (
    <div className="profile-section">
      <div className="profile-section-title">Offline Access</div>

      {!available ? (
        <p className="profile-photo-hint">
          This browser does not allow offline storage, so DocuVault needs a connection to load.
        </p>
      ) : (
        <>
          <p className="profile-photo-hint">
            {stats?.entries
              ? `${stats.entries} screen${stats.entries === 1 ? '' : 's'} saved on this device (${formatBytes(stats.bytes)}). `
              : 'Nothing saved yet. '}
            Browse the app while online once and those screens stay readable without a connection.
            Last refreshed: {lastSyncLabel(stats?.lastSyncAt)}.
          </p>

          {confirming ? (
            <div className="profile-photo-actions">
              <button type="button" className="profile-remove-link" onClick={handleClear}
                disabled={isClearing}>
                {isClearing ? 'Clearing…' : 'Yes, delete offline data'}
              </button>
              <button type="button" className="btn-secondary profile-btn-sm"
                onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary profile-btn-sm"
              onClick={() => setConfirming(true)}
              disabled={!stats?.entries}
              style={{ marginTop: 12 }}>
              Clear offline data
            </button>
          )}
        </>
      )}
    </div>
  );
}
