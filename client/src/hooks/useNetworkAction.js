/**
 * useNetworkAction — async API call wrapper (offline checks disabled for localhost).
 *
 * All network-status pre-flight checks have been removed so the app works
 * fully on localhost / LAN without internet. Actions are always executed.
 * The original behaviour can be restored from git history.
 */

import { useCallback, useState } from 'react';

export function useNetworkAction() {
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (actionFn, { onSuccess, onError } = {}) => {
      setIsPending(true);
      try {
        const result = await actionFn();
        onSuccess?.(result);
      } catch (err) {
        onError?.(err);
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { execute, isPending };
}
