import { createContext, useCallback } from 'react';

/**
 * NetworkContext — simplified for localhost / LAN presentation use.
 *
 * All network status checks have been removed. The app is always treated as
 * online so that running on localhost (or a local network without internet)
 * never triggers the "You are offline" banner or blocks any action.
 *
 * If you need to re-enable the server health probe for a deployed environment,
 * restore the original NetworkContext.jsx from git history.
 */

export const CONNECTION_RESTORED_EVENT = 'docuvault:connection-restored';

export const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
  // Always online — no probing, no navigator.onLine checks.
  const status = 'online';
  const isOnline = true;
  const isOffline = false;
  const justRestored = false;

  // No-op stubs kept so any component that calls these doesn't crash.
  const retryNow = useCallback(() => {}, []);
  const markServerDown = useCallback(() => {}, []);

  return (
    <NetworkContext.Provider
      value={{
        status,
        isOnline,
        isOffline,
        justRestored,
        retryNow,
        markServerDown,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
