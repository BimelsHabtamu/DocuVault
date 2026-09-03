const SA  = 'super_admin';
const SYS = 'system_admin';
const GEN = 'generator';
const APP = 'approver';
const REC = 'recipient';

// ── Recipient navigation ─────────────────────────────────────────────────────
export const recipientNavGroups = [
  {
    group: 'Main', translationKey: 'main',
    items: [
      { to: '/dashboard',    translationKey: 'dashboard',   roles: [REC], icon: 'home' },
      { to: '/my-documents', translationKey: 'myDocuments', roles: [REC], icon: 'doc' },
      { to: '/verify-doc',   translationKey: 'verify',      roles: [REC], icon: 'shield' },
    ],
  },
];

// ── Approver navigation ───────────────────────────────────────────────────────
export const approverNavGroups = [
  {
    group: 'Main', translationKey: 'main',
    items: [
      { to: '/approver', translationKey: 'dashboard', roles: [APP], icon: 'home' },
    ],
  },
  {
    group: 'Documents', translationKey: 'documents',
    items: [
      { to: '/documents', translationKey: 'documentsPage', roles: [APP], icon: 'doc' },
    ],
  },
  {
    group: 'Approval', translationKey: 'approvalGroup',
    items: [
      { to: '/approvals', translationKey: 'approvals', roles: [APP], icon: 'approval' },
    ],
  },
  {
    group: 'Verification', translationKey: 'verification',
    items: [
      { to: '/verify-doc', translationKey: 'verify', roles: [APP], icon: 'shield' },
    ],
  },
  {
    group: 'Account', translationKey: 'account',
    items: [
      { to: '/settings', translationKey: 'mySettings', roles: [APP], icon: 'user' },
    ],
  },
];

// ── Generator navigation ──────────────────────────────────────────────────────
export const generatorNavGroups = [
  {
    group: 'Main', translationKey: 'main',
    items: [
      { to: '/dashboard', translationKey: 'dashboard', roles: [GEN], icon: 'home' },
    ],
  },

  {
    group: 'Documents', translationKey: 'documents',
    items: [
      { to: '/documents', translationKey: 'documents', roles: [GEN], icon: 'doc' },
      { to: '/generate',  translationKey: 'generate',  roles: [GEN], icon: 'plus-doc' },
    ],
  },

  {
    group: 'Verification', translationKey: 'verification',
    items: [
      { to: '/verify-doc', translationKey: 'verify', roles: [GEN], icon: 'shield' },
    ],
  },

  {
    group: 'Account', translationKey: 'account',
    items: [
      { to: '/settings', translationKey: 'mySettings', roles: [GEN], icon: 'user' },
    ],
  },
];

// ── Main navigation (all non-recipient roles) ────────────────────────────────
export const navGroups = [

  // ── MAIN ────────────────────────────────────────────────────────────────────
  {
    group: 'Main', translationKey: 'main',
    items: [
      { to: '/dashboard', translationKey: 'dashboard', roles: [SA, SYS, GEN, APP], icon: 'home' },
    ],
  },

  // ── USER & ACCESS ───────────────────────────────────────────────────────────
  {
    group: 'User & Access', translationKey: 'userAccess',
    items: [
      { to: '/users', translationKey: 'users', roles: [SA, SYS], icon: 'users' },
      { to: '/roles',  translationKey: 'rolesPermissions', roles: [SA], icon: 'lock' },
    ],
  },

  // ── TEMPLATES ───────────────────────────────────────────────────────────────
  {
    group: 'Templates', translationKey: 'templates',
    items: [
      { to: '/templates',     translationKey: 'templates',    roles: [SA, SYS],      icon: 'template' },
      { to: '/data-sources',  translationKey: 'dataSources',  roles: [SA, SYS],      icon: 'database' },
      { to: '/field-mapping', translationKey: 'fieldMapping', roles: [SA],            icon: 'map' },
    ],
  },

  // ── DOCUMENTS ───────────────────────────────────────────────────────────────
  {
    group: 'Documents', translationKey: 'documents',
    items: [
      { to: '/generate',  translationKey: 'generate',      roles: [SA, SYS, GEN],      icon: 'plus-doc' },
      { to: '/documents', translationKey: 'allDocuments',  roles: [SA, SYS, GEN],      icon: 'doc' },
      { to: '/documents', translationKey: 'documents',     roles: [APP],               icon: 'doc' },
    ],
  },

  // ── WORKFLOW ─────────────────────────────────────────────────────────────────
  {
    group: 'Workflow', translationKey: 'workflow',
    items: [
      { to: '/signature-requests', translationKey: 'signatureRequests', roles: [SA, SYS, GEN],      icon: 'pen' },
      { to: '/approvals',          translationKey: 'pendingApprovals',  roles: [APP],               icon: 'check-circle' },
      { to: '/approval-history',   translationKey: 'approvalHistory',   roles: [APP],               icon: 'history' },
      { to: '/approvals',          translationKey: 'approvals',         roles: [SA, SYS],            icon: 'check-circle' },
      { to: '/delivery-logs',      translationKey: 'deliveryLogs',      roles: [SA, SYS],            icon: 'mail' },
    ],
  },

  // ── VERIFICATION ─────────────────────────────────────────────────────────────
  {
    group: 'Verification', translationKey: 'verification',
    items: [
      { to: '/verify-doc', translationKey: 'verify', roles: [SA, SYS, GEN, APP], icon: 'shield' },
    ],
  },

  // ── AUDIT & REPORTS ──────────────────────────────────────────────────────────
  {
    group: 'Audit & Reports', translationKey: 'auditReports',
    items: [
      { to: '/audit',   translationKey: 'auditLogs',         roles: [SA, SYS], icon: 'clipboard' },
      { to: '/reports', translationKey: 'reportsAnalytics',  roles: [SA, SYS], icon: 'chart' },
    ],
  },

  // ── SYSTEM ──────────────────────────────────────────────────────────────────
  {
    group: 'System', translationKey: 'system',
    items: [
      { to: '/settings/system',      translationKey: 'systemSettings',     roles: [SA],  icon: 'cog' },
      { to: '/settings/connections', translationKey: 'externalConnections', roles: [SA],  icon: 'server' },
      { to: '/settings/notifications', translationKey: 'notificationSettings', roles: [SA], icon: 'bell' },
    ],
  },
];

export default navGroups;
