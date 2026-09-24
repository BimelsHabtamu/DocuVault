/**
 * ConnectionIndicator — small status pill shown in the Navbar.
 *
 * 🟢 Online        (hidden when fully online to reduce noise — optional, change below)
 * 🔴 Offline
 * 🟡 Reconnecting
 * ⚠️  Server down
 */

import { useNetwork } from '../../hooks/useNetwork';

const INDICATOR_CONFIG = {
  online: {
    dot: 'conn-dot conn-dot--online',
    label: 'Online',
    show: false, // hide when healthy to avoid cluttering the navbar
  },
  offline: {
    dot: 'conn-dot conn-dot--offline',
    label: 'Offline',
    show: true,
  },
  'server-down': {
    dot: 'conn-dot conn-dot--server-down',
    label: 'Server Down',
    show: true,
  },
  reconnecting: {
    dot: 'conn-dot conn-dot--reconnecting',
    label: 'Reconnecting',
    show: true,
  },
};

export default function ConnectionIndicator() {
  const { status } = useNetwork();
  const cfg = INDICATOR_CONFIG[status] ?? INDICATOR_CONFIG.online;

  if (!cfg.show) return null;

  return (
    <span
      className="conn-indicator"
      title={cfg.label}
      aria-label={`Connection status: ${cfg.label}`}
      role="status"
    >
      <span className={cfg.dot} aria-hidden="true" />
      <span className="conn-indicator__label">{cfg.label}</span>
    </span>
  );
}
