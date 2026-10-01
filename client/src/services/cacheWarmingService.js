/**
 * cacheWarmingService.js — eager cache pre-population.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The offline cache (offlineCache.js + api.js) is lazy by design: data is only
 * cached the first time a page is visited while online. For a presentation or any
 * scenario where the internet might drop, the user would need to manually visit
 * every page first — which is easy to forget.
 *
 * This service solves that by proactively fetching all key endpoints right after:
 *   1. A successful online login.
 *   2. A network reconnection (so cached data is refreshed, not stale).
 *
 * WHAT IT CACHES
 * ──────────────
 * Endpoints are split by role. Each role gets:
 *   • Its own dashboard data.
 *   • The shared pages it can navigate to (templates, documents, etc.).
 *
 * All fetches are fire-and-forget — failures are swallowed silently. Cache
 * warming is an enhancement, not a dependency. If any endpoint is unavailable
 * (e.g. the server is shutting down), the rest still complete.
 *
 * PERFORMANCE
 * ───────────
 * All fetches within a role's set run in parallel (Promise.allSettled). There is
 * a short delay before warming starts so the critical login/redirect render is
 * not competing for bandwidth.
 */

import { api } from './api';
import { ROLES } from '../utils/roles';

/** Delay before the first warming fetch starts, in ms. Keeps the login redirect snappy. */
const WARM_DELAY_MS = 1500;

/**
 * Silently call an api.get() and swallow any error.
 * Returns the resolved value or null.
 */
async function safeGet(path) {
  try {
    return await api.get(path);
  } catch {
    return null;
  }
}

/**
 * Endpoints shared by every authenticated role.
 * Fetching these ensures the sidebar / navbar always have data.
 */
const SHARED_ENDPOINTS = [
  '/notifications',
];

/**
 * Endpoint groups per role. Only the endpoints relevant to that role are fetched.
 * Using literal path strings (not service wrappers) keeps this file independent
 * of service refactors and avoids double-importing.
 */
const ROLE_ENDPOINTS = {
  [ROLES.SUPER_ADMIN]: [
    // Dashboard
    '/dashboard/kpis',
    '/dashboard/trends',
    '/dashboard/my-stats',
    // Templates
    '/templates',
    // Documents
    '/documents/search',
    // Approvals
    '/signatures/pending',
    // Audit & Reports
    '/audit-logs',
    '/reports/filter-options',
    '/archive/overview',
    '/documents/deliveries/report',
    // Users
    '/users',
    '/users/approvers',
    // Settings
    '/settings',
    '/data-sources',
    '/external-db',
  ],
  [ROLES.SYSTEM_ADMIN]: [
    '/dashboard/kpis',
    '/dashboard/trends',
    '/dashboard/my-stats',
    '/templates',
    '/documents/search',
    '/signatures/pending',
    '/audit-logs',
    '/reports/filter-options',
    '/archive/overview',
    '/documents/deliveries/report',
    '/users',
    '/users/approvers',
    '/settings',
    '/data-sources',
    '/external-db',
  ],
  [ROLES.GENERATOR]: [
    '/dashboard/my-stats',
    '/templates',
    '/documents/search',
    '/users/approvers',
    '/data-sources',
  ],
  [ROLES.APPROVER]: [
    '/dashboard/my-stats',
    '/templates',
    '/signatures/pending',
    '/documents/search',
  ],
  [ROLES.RECIPIENT]: [
    '/recipient/documents',
  ],
};

/**
 * Warm the cache for the given user role.
 *
 * @param {string} role  — one of the ROLES constants
 * @returns {Promise<void>}  always resolves, never throws
 */
export async function warmCacheForRole(role) {
  if (!role) return;

  // Small delay so the post-login navigation render gets priority on the network.
  await new Promise((resolve) => setTimeout(resolve, WARM_DELAY_MS));

  const roleEndpoints = ROLE_ENDPOINTS[role] ?? [];
  const allEndpoints = [...SHARED_ENDPOINTS, ...roleEndpoints];

  // Deduplicate (in case a role list duplicates a shared endpoint)
  const unique = [...new Set(allEndpoints)];

  // Fire all in parallel — we don't need the results, just the side-effect of
  // api.js writing each response into IndexedDB via writeCachedResponse().
  await Promise.allSettled(unique.map((path) => safeGet(path)));
}

/**
 * Re-warm after a reconnection. Identical to the initial warm but without any
 * delay — we want data refreshed as quickly as possible after coming back online.
 *
 * @param {string} role
 * @returns {Promise<void>}
 */
export async function refreshCacheForRole(role) {
  if (!role) return;

  const roleEndpoints = ROLE_ENDPOINTS[role] ?? [];
  const allEndpoints = [...SHARED_ENDPOINTS, ...roleEndpoints];
  const unique = [...new Set(allEndpoints)];

  await Promise.allSettled(unique.map((path) => safeGet(path)));
}
