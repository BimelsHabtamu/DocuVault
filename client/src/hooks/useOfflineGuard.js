/**
 * useOfflineGuard — action wrapper (offline checks disabled for localhost).
 *
 * All network-status pre-flight checks have been removed so the app works
 * fully on localhost / LAN without internet. Actions are always executed.
 * The original guarded behaviour can be restored from git history.
 */

import { useCallback, useState } from 'react';

export function useOfflineGuard() {
  const [isPending, setIsPending] = useState(false);

  const guardedAction = useCallback(
    async (
      actionFn,
      { onSuccess, onError, onBlocked: _onBlocked } = {}
    ) => {
      setIsPending(true);
      try {
        const result = await actionFn();
        onSuccess?.(result);
        return true;
      } catch (err) {
        onError?.(err);
        return false;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  // Always online — nothing is ever blocked.
  const isOffline = false;

  const offlineClickBlocker = useCallback(() => false, []);

  return {
    guardedAction,
    isPending,
    isOffline,
    offlineClickBlocker,
    networkStatus: 'online',
  };
}
