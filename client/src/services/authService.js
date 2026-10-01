import { api, setAuthToken } from './api';
import { clearAllCaches } from './offlineCache';
import { clearServiceWorkerCaches } from './serviceWorker';

const TOKEN_STORAGE_KEY = 'doc_automation_token';


const CREDENTIAL_HASH_KEY = 'doc_automation_cred_hash';
const CREDENTIAL_SALT_KEY = 'doc_automation_cred_salt';

/** Generate a random hex salt string. */
function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash of an arbitrary string, returned as a hex string. */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashCredentials(email, password, salt) {
  try {
    return await sha256(`${salt}:${email.toLowerCase().trim()}:${password}`);
  } catch {
    return null;
  }
}

export async function saveCredentialHash(email, password, rememberMe) {
  try {
    const salt = generateSalt();
    const hash = await hashCredentials(email, password, salt);
    if (!hash) return; // Web Crypto unavailable — graceful degradation

    const store = rememberMe ? localStorage : sessionStorage;
    store.setItem(CREDENTIAL_SALT_KEY, salt);
    store.setItem(CREDENTIAL_HASH_KEY, hash);
  } catch {
  }
}

export async function verifyOfflineCredentials(email, password) {
  try {
    // Check both storage tiers
    const salt =
      sessionStorage.getItem(CREDENTIAL_SALT_KEY) ||
      localStorage.getItem(CREDENTIAL_SALT_KEY);
    const storedHash =
      sessionStorage.getItem(CREDENTIAL_HASH_KEY) ||
      localStorage.getItem(CREDENTIAL_HASH_KEY);

    if (!salt || !storedHash) return false;

    const hash = await hashCredentials(email, password, salt);
    if (!hash) return false;

    // Constant-time comparison to prevent timing attacks
    if (hash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) {
      diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/** Remove the credential hash from all storage tiers. */
export function clearCredentialHash() {
  sessionStorage.removeItem(CREDENTIAL_HASH_KEY);
  sessionStorage.removeItem(CREDENTIAL_SALT_KEY);
  localStorage.removeItem(CREDENTIAL_HASH_KEY);
  localStorage.removeItem(CREDENTIAL_SALT_KEY);
}

/**
 * ── Offline-safe user profile cache ──────────────────────────────────────────
 *
 * We store a JSON snapshot of the user object (no password, no raw token) so
 * that previously-authenticated users can be identified while offline.
 *
 * Storage rules mirror the token:
 *   • rememberMe=true  → localStorage  (persists across browser sessions)
 *   • rememberMe=false → sessionStorage (cleared when tab closes)
 *
 * Security notes:
 *   - We NEVER store passwords.
 *   - We store only non-sensitive profile fields (id, role, name, email, avatar).
 *   - The cached profile is used ONLY to render the UI while offline; every
 *     real server operation still requires the live token and a live server.
 *   - The cache is cleared on logout together with the token.
 */
const USER_CACHE_KEY = 'doc_automation_user_cache';

/** Which fields of the user object we allow into the cache. */
const SAFE_USER_FIELDS = [
  'id', 'uuid', 'email', 'full_name', 'role',
  'avatar_url', 'preferred_language', 'theme',
];

/** Persist a sanitized snapshot of the user to the correct storage tier. */
export function saveUserToCache(user) {
  if (!user) return;
  // Only keep safe, non-sensitive fields
  const safe = {};
  SAFE_USER_FIELDS.forEach((k) => { if (user[k] !== undefined) safe[k] = user[k]; });
  const serialised = JSON.stringify(safe);
  // Mirror the storage tier of the token
  if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
    localStorage.setItem(USER_CACHE_KEY, serialised);
  } else {
    sessionStorage.setItem(USER_CACHE_KEY, serialised);
  }
}

/** Retrieve the cached user profile, or null if none exists. */
export function loadUserFromCache() {
  try {
    const raw =
      sessionStorage.getItem(USER_CACHE_KEY) ||
      localStorage.getItem(USER_CACHE_KEY) ||
      null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Remove the cached user profile from all storage tiers. */
export function clearUserCache() {
  sessionStorage.removeItem(USER_CACHE_KEY);
  localStorage.removeItem(USER_CACHE_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authenticate the user.
 * @param {string}  email
 * @param {string}  password
 * @param {boolean} [rememberMe=false]  true → persist token in localStorage
 *                                      false → session only (sessionStorage)
 */
export async function login(email, password, rememberMe = false) {
  const res = await api.post('/auth/login', { email, password });
  const { token, user } = res.data;
  setAuthToken(token);

  if (rememberMe) {
    // Persist across browser sessions
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY); // clean up in case of switch
  } else {
    // Session only — cleared when tab/browser closes
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.removeItem(TOKEN_STORAGE_KEY);   // clean up in case of switch
  }

  // Cache the user profile for offline session restoration
  saveUserToCache(user);

  // Save a credential hash so the user can log in again while offline
  await saveCredentialHash(email, password, rememberMe);

  return user;
}

export async function fetchCurrentUser() {
  const res = await api.get('/auth/me');
  // Refresh the offline cache with the latest profile
  saveUserToCache(res.data);
  return res.data;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // Signing out must always succeed locally. If the server is unreachable the
    // JWT simply expires on its own, and the token + caches are cleared below.
  } finally {
    setAuthToken(null);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    // Also clear the offline user cache on explicit logout
    clearUserCache();
    // Clear the offline credential hash
    clearCredentialHash();
    // Wipe every cached document/response and the worker's shell so nothing
    // from this session is readable by the next person on this device.
    await clearAllCaches();
    void clearServiceWorkerCaches();
  }
}

/**
 * On app startup, restore a previously saved token.
 * Checks sessionStorage first (current-session login), then localStorage
 * (a "keep me signed in" login from a previous session).
 */
export function restoreTokenFromStorage() {
  const token =
    sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    null;
  if (token) setAuthToken(token);
  return token;
}

/** Self-service "Forgot password" — public, available to every role except Super Admin
 *  (enforced server-side). Always resolves with a generic message. */
export async function forgotPassword(email) {
  return api.post('/auth/forgot-password', { email });
}

/** Completes the reset started above, using the token from the emailed link. */
export async function resetPassword(token, newPassword) {
  return api.post('/auth/reset-password', { token, new_password: newPassword });
}
