// In development Vite proxies /api/* → http://localhost:5000 (vite.config.js).
// Using a relative path means the browser calls the same origin → zero CORS issues.
// In production VITE_API_URL must be set to the deployed backend base URL.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

let inMemoryToken = null;

export function setAuthToken(token) {
  inMemoryToken = token;
}

export function getAuthToken() {
  return inMemoryToken;
}

// ── Network-context bridge ────────────────────────────────────────────────────
// api.js is a plain JS module (not a React component), so it cannot call hooks.
// Instead, NetworkContext injects its `markServerDown` callback here at startup
// so that api.js can signal failures back to the context without prop-drilling.

let _markServerDown = null;

/**
 * Called once by NetworkProvider (or ConnectionBanner) to register the callback.
 * After this, whenever a network-level error occurs, the context is notified.
 */
export function registerMarkServerDown(fn) {
  _markServerDown = fn;
}

// ── Network pre-check error ───────────────────────────────────────────────────

/**
 * A dedicated error class so callers can distinguish "we refused to send
 * the request because we are offline" from a genuine server error.
 */
export class OfflineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OfflineError';
    this.isOfflineError = true;
  }
}

// ── Core request function ─────────────────────────────────────────────────────

async function request(path, { method = 'GET', body, headers = {}, skipOfflineCheck = false } = {}) {
  // ── Pre-flight connection check ──────────────────────────────────────────
  // Refuse to fire mutating (or any) requests when we know we're offline.
  // GET requests can still be attempted (reads may work from cache), but we
  // still block them when navigator.onLine is false to stay fully consistent.
  if (!skipOfflineCheck && !navigator.onLine) {
    throw new OfflineError(
      'You are offline. Please check your internet connection.'
    );
  }

  const url = `${BASE_URL}${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // fetch() itself rejected — backend unreachable, DNS failure, etc.
    if (import.meta.env.DEV) {
      console.error('[api] Network error calling', url, networkErr);
    }
    // Notify the NetworkContext so the banner appears immediately
    if (_markServerDown) _markServerDown();
    throw new OfflineError(
      'Unable to connect to the server. Please check your connection and try again.'
    );
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Unexpected response from server (status ${res.status}).`);
  }

  if (!res.ok) {
    const error = new Error(payload.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  return payload; // { success, message, data }
}

export const api = {
  get:    (path)        => request(path),
  post:   (path, body)  => request(path, { method: 'POST',  body }),
  put:    (path, body)  => request(path, { method: 'PUT',   body }),
  patch:  (path, body)  => request(path, { method: 'PATCH', body }),
  delete: (path)        => request(path, { method: 'DELETE' }),
};
