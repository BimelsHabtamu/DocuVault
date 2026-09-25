/**
 * useOfflineGuard — centralized offline protection for server-mutating actions.
 *
 * This is the SINGLE authoritative gate for all operations that change server/database
 * state. Import this hook and call `guardedAction()` instead of calling the API directly.
 *
 * ── What it does ─────────────────────────────────────────────────────────────
 *
 *  • If the device is offline or the server is unreachable:
 *    - The action function is NOT called (data-integrity guarantee).
 *    - A toast is shown: "You are offline. Please reconnect to perform this action."
 *    - `onBlocked()` is called if provided (e.g., to keep a modal open).
 *    - Returns false.
 *
 *  • If online:
 *    - The action function is called and awaited.
 *    - On success: `onSuccess(result)` is called.
 *    - On failure: `onError(err)` is called; if the error is network-level,
 *      the NetworkContext is updated and the banner appears.
 *    - Returns true.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   const { guardedAction, isPending } = useOfflineGuard();
 *
 *   // In a button handler:
 *   const handleApprove = () =>
 *     guardedAction(
 *       () => signatureService.approve(id, otp),
 *       {
 *         onSuccess: (result) => { showToast('Approved!', 'success'); ... },
 *         onError:   (err)    => { showToast(err.message, 'error'); },
 *         // Optional: override the offline toast message for this specific action
 *         offlineMessage: 'You are offline. Approval requires a live connection.',
 *       }
 *     );
 *
 * ── Button guard usage ────────────────────────────────────────────────────────
 *
 *   You can also use the returned `isOffline` flag to disable buttons / show tooltips:
 *
 *   const { isOffline } = useOfflineGuard();
 *   <button disabled={isOffline} title={isOffline ? 'You are offline' : ''}>
 *     Approve
 *   </button>
 *
 * ── IMPORTANT ─────────────────────────────────────────────────────────────────
 *
 *   NEVER automatically retry blocked actions after reconnection.
 *   The user must explicitly click the button again.
 */

import { useCallback, useState } from 'react';
import { useNetwork } from './useNetwork';
import { useToast } from './useToast';
import { OfflineError } from '../services/api';

const DEFAULT_OFFLINE_MESSAGE =
  'You are offline. Please reconnect to perform this action.';

export function useOfflineGuard() {
  const { isOnline, status } = useNetwork();
  const { showToast } = useToast();
  const [isPending, setIsPending] = useState(false);

  /**
   * @param {() => Promise<any>} actionFn     — the server mutation to perform
   * @param {object}             [opts]
   * @param {(result) => void}   [opts.onSuccess]
   * @param {(err) => void}      [opts.onError]
   * @param {() => void}         [opts.onBlocked]    — called when blocked by offline state
   * @param {string}             [opts.offlineMessage]
   * @returns {Promise<boolean>}  true if the action was attempted, false if blocked
   */
  const guardedAction = useCallback(
    async (
      actionFn,
      {
        onSuccess,
        onError,
        onBlocked,
        offlineMessage = DEFAULT_OFFLINE_MESSAGE,
      } = {}
    ) => {
      // ── Pre-flight offline check ──────────────────────────────────────────
      const effectivelyOffline =
        !navigator.onLine || status === 'offline' || status === 'server-down';

      if (effectivelyOffline) {
        const msg =
          status === 'server-down'
            ? 'Server connection unavailable. Please try again later.'
            : offlineMessage;
        showToast(msg, 'error');
        onBlocked?.();
        onError?.(new OfflineError(msg));
        return false;
      }

      // ── Execute the action ────────────────────────────────────────────────
      setIsPending(true);
      try {
        const result = await actionFn();
        onSuccess?.(result);
        return true;
      } catch (err) {
        if (err instanceof OfflineError || err.isOfflineError) {
          showToast(err.message, 'error');
        }
        onError?.(err);
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [isOnline, status, showToast]
  );

  /**
   * Convenience: returns true when ANY blocked state is active.
   * Use this to disable buttons declaratively.
   */
  const isOffline =
    !navigator.onLine || status === 'offline' || status === 'server-down';

  /**
   * Convenience: a click handler factory for simple cases where you just want
   * to block the action and show the offline toast with no other logic.
   *
   *   <button onClick={offlineClickBlocker} disabled={isOffline}>…</button>
   *
   * For the disabled state, prefer `disabled={isOffline}` so the button
   * visually communicates the blocked state.
   */
  const offlineClickBlocker = useCallback(
    (e) => {
      if (isOffline) {
        e?.preventDefault?.();
        showToast(DEFAULT_OFFLINE_MESSAGE, 'error');
        return true; // blocked
      }
      return false; // not blocked
    },
    [isOffline, showToast]
  );

  return {
    guardedAction,
    isPending,
    isOffline,
    offlineClickBlocker,
    /** Current network status string for fine-grained conditional rendering */
    networkStatus: status,
  };
}
