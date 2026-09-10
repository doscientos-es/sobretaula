export const PLATFORM_AUDIT_ACTIONS = [
  'platform_invitation_created',
  'platform_invitation_accepted',
  'platform_member_granted',
  'platform_member_role_changed',
  'platform_member_revoked',
  'tenant_created',
  'tenant_settings_updated',
  'tenant_status_changed',
] as const

export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number]

export interface PlatformAuditEvent {
  action: PlatformAuditAction
  actor: string
  createdAt: string
  id: string
  summary: string
  target: string
}

function text(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value : null
}

export function platformAuditActionLabel(action: PlatformAuditAction): string {
  return {
    platform_invitation_accepted: 'Invitación de operador aceptada',
    platform_invitation_created: 'Invitación de operador creada',
    platform_member_granted: 'Acceso de operador concedido',
    platform_member_revoked: 'Acceso de operador revocado',
    platform_member_role_changed: 'Rol de operador modificado',
    tenant_created: 'Tenant creado',
    tenant_settings_updated: 'Configuración de tenant modificada',
    tenant_status_changed: 'Estado de tenant modificado',
  }[action]
}

/** Creates a human-readable, safe summary from immutable audit metadata. */
export function platformAuditSummary(
  action: PlatformAuditAction,
  metadata: Record<string, unknown>,
): string {
  if (action === 'tenant_status_changed') {
    const from = text(metadata, 'from') ?? 'desconocido'
    const to = text(metadata, 'to') ?? 'desconocido'
    const reason = text(metadata, 'reason')
    return `De ${from} a ${to}${reason ? ` · Motivo: ${reason}` : ''}`
  }
  if (action === 'platform_member_role_changed') {
    return `De ${text(metadata, 'from') ?? 'desconocido'} a ${text(metadata, 'to') ?? 'desconocido'}`
  }
  if (action === 'platform_invitation_created') {
    return `Correo: ${text(metadata, 'email') ?? 'no disponible'} · Rol: ${text(metadata, 'role') ?? 'no disponible'}`
  }
  if (action === 'platform_invitation_accepted' || action === 'platform_member_granted') {
    return `Rol: ${text(metadata, 'role') ?? 'no disponible'}`
  }
  if (action === 'platform_member_revoked') {
    return `Rol anterior: ${text(metadata, 'role') ?? 'no disponible'}`
  }
  if (action === 'tenant_created') {
    return `Propietario: ${text(metadata, 'owner_email') ?? 'no disponible'}`
  }
  return 'Se actualizaron los datos generales del restaurante.'
}
