export { getPlatformAdminAccess, getPlatformDashboard } from './application/platform-dashboard'
export type {
  PlatformDashboard,
  PlatformDashboardSubscription,
  PlatformDashboardTenant,
} from './application/platform-dashboard'
export {
  getPlatformOperators,
  acceptPlatformInvitation,
  invitePlatformOperator,
  revokePlatformOperator,
  updatePlatformOperatorRole,
  updatePlatformTenantStatus,
} from './application/platform-operators'
export {
  canManagePlatformOperator,
  isPlatformAdminRole,
  isManagedTenantStatus,
  MANAGED_TENANT_STATUSES,
  PLATFORM_ADMIN_ROLES,
} from './domain/platform-admin'
export type { ManagedTenantStatus, PlatformAdminRole } from './domain/platform-admin'
export { PlatformConsolePage } from './ui/platform-console-page'
export {
  getPlatformFiscalSettings,
  savePlatformFiscalSettings,
} from './application/platform-settings'
export type { PlatformFiscalSettings } from './application/platform-settings'
export { PlatformOperatorsPage } from './ui/platform-operators-page'
export { PlatformSettingsPage } from './ui/platform-settings-page'
export { PlatformInvitationPage } from './ui/platform-invitation-page'
export type {
  PlatformOperator,
  PlatformOperatorDirectory,
  PlatformOperatorInvitation,
} from './application/platform-operators'
