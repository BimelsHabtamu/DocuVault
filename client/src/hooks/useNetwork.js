import { useContext } from 'react';
import { NetworkContext } from '../context/NetworkContext';

/**
 * useNetwork — consume the global connection status.
 *
 * Returns:
 *   status       'online' | 'offline' | 'server-down' | 'reconnecting'
 *   isOnline     boolean — true only when fully connected
 *   retryNow()   force an immediate server probe
 *   markServerDown() signal that a live API request just failed with a network error
 */
export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used within a <NetworkProvider>.');
  }
  return ctx;
}
