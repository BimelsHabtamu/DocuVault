/**
 * useNetworkAction — wraps an async API call with offline protection.
 *
 * Usage:
 *   const { execute, isPending } = useNetworkAction();
 *
 *   const handleSubmit = () => execute(
 *     () => api.post('/documents', data),
 *     {
 *       onSuccess: (result) => { ... },
 *       onError:   (err)    => { ... },
 *       offlineMessage: 'You are offline. Your changes were not saved.',
 *     }
 *   );
 *
 * If the device is offline when `execute` is called:
 *   - the request is NOT sent
 *   - `onError` is called with an OfflineError
 *   - the calling component can preserve form state normally
 *   - a toast appears with the offline message
 *
 * If the request fails mid-flight (network dropped):
 *   - `onError` receives the error as usual
 *   - the network context marks the server as down
 *
 * NEVER automatically retries — the user must click again.
 */

import { useCallback, useRef, useState } from 'react';
import { useNetwork } from './useNetwork';
import { useToast } from './useToast';
import { OfflineError } from '../services/api';

export function useNetworkAction() {
  const { isOnline, status } = useNetwork();
  const { showToast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const abortRef = useRef(null);

  /**
   * @param {() => Promise<any>} actionFn  — the API call to make
   * @param {object}             opts
   * @param {(result) => void}   [opts.onSuccess]
   * @param {(err) => void}      [opts.onError]
   * @param {string}             [opts.offlineMessage]  — toast shown when blocked
   */
  const execute = useCallback(
    async (
      actionFn,
      {
        onSuccess,
        onError,
        offlineMessage = 'You are offline. The operation was not performed.',
      } = {}
    ) => {
      // ── Pre-flight offline check ─────────────────────────────────────────
      if (!navigator.onLine || status === 'offline') {
        showToast(offlineMessage, 'error');
        const err = new OfflineError(offlineMessage);
        onError?.(err);
        return;
      }

      if (status === 'server-down') {
        const msg = 'Server connection unavailable. Please try again later.';
        showToast(msg, 'error');
        const err = new OfflineError(msg);
        onError?.(err);
        return;
      }

      // ── Execute the request ───────────────────────────────────────────────
      setIsPending(true);
      try {
        const result = await actionFn();
        onSuccess?.(result);
      } catch (err) {
        // Don't show a success message — only surface real failures
        if (err instanceof OfflineError || err.isOfflineError) {
          showToast(err.message, 'error');
        }
        onError?.(err);
      } finally {
        setIsPending(false);
      }
    },
    [isOnline, status, showToast]
  );

  return { execute, isPending };
}
