const SA  = 'super_admin';
const SYS = 'system_admin';
const GEN = 'generator';
const APP = 'approver';
const REC = 'recipient';

// ── Recipient-only navigation ────────────────────────────────────────────────
// Shown to 'recipient' role only. Completely separate from the admin/generator nav.
const recipientNavGroups = [
  {
    group: 'Main', translationKey: 'main',
    items: [
      { to: '/dashboard',    label: 'Dashboard',       translationKey: 'dashboard',    roles: [REC], icon: 'home' },
      { to: '/my-documents', label: 'My Documents',    translationKey: 'myDocuments',  roles: [REC], icon: 'doc' },
      { to: '/verify-doc',   label: 'Verify Document', translationKey: 'verify',       roles: [REC], icon: 'shield' },
    ],
  },
  {
    group: 'Account', translationKey: 'account',
    items: [
      { to: '/settings', label: 'My Settings', translationKey: 'mySettings', roles: [REC], icon: 'cog' },
    ],
  },
];

// ── Admin / Generator / Approver navigation ───────────────────────────────────
const navGroups = [
  {
    group: 'Main', translationKey: 'main',
    items: [
      { to: '/dashboard', label: 'Dashboard', translationKey: 'dashboard', roles: [SA, SYS, GEN, APP, REC], icon: 'home' },
    ],
  },
  {
    group: 'Documents', translationKey: 'documents',
    items: [
      { to: '/templates', label: 'Templates',         translationKey: 'templates',     roles: [SA, SYS],           icon: 'template' },
      { to: '/generate',  label: 'Generate Document', translationKey: 'generate',      roles: [SA, SYS, GEN, APP], icon: 'plus-doc' },
      { to: '/documents', label: 'Documents',         translationKey: 'documentsPage', roles: [SA, SYS, GEN, APP], icon: 'doc' },
    ],
  },
  {
    group: 'Workflow', translationKey: 'workflow',
    items: [
      { to: '/approvals',  label: 'Approvals',        translationKey: 'approvals', roles: [SA, SYS, APP],           icon: 'check-circle' },
      { to: '/verify-doc', label: 'Verify Document',  translationKey: 'verify',    roles: [SA, SYS, GEN, APP],      icon: 'shield' },
    ],
  },
  {
    group: 'Administration', translationKey: 'administration',
    items: [
      { to: '/users',          label: 'Users',          translationKey: 'users',    roles: [SA, SYS], icon: 'users' },
      { to: '/audit',          label: 'Audit Logs',     translationKey: 'audit',    roles: [SA, SYS], icon: 'clipboard' },
      { to: '/delivery-logs',  label: 'Delivery Logs',  translationKey: 'delivery', roles: [SA, SYS], icon: 'mail' },
    ],
  },
  {
    group: 'Account', translationKey: 'account',
    items: [
      { to: '/settings/system', label: 'System Configuration', translationKey: 'systemConfiguration', roles: [SA],      icon: 'server' },
      { to: '/settings',        label: 'My Settings',          translationKey: 'mySettings',          roles: [SA, SYS, GEN, APP], icon: 'cog' },
    ],
  },
];

export { navGroups, recipientNavGroups };
export default navGroups;
