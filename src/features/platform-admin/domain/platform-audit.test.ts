import { describe, expect, it } from 'vitest'

import { platformAuditActionLabel, platformAuditSummary } from './platform-audit'

describe('platform audit presentation', () => {
  it('summarizes a tenant status change with its mandatory reason', () => {
    expect(
      platformAuditSummary('tenant_status_changed', {
        from: 'active',
        reason: 'Impago confirmado',
        to: 'suspended',
      }),
    ).toBe('De active a suspended · Motivo: Impago confirmado')
  })

  it('labels immutable operator and tenant events for the console', () => {
    expect(platformAuditActionLabel('platform_member_revoked')).toBe('Acceso de operador revocado')
    expect(platformAuditActionLabel('tenant_settings_updated')).toBe(
      'Configuración de tenant modificada',
    )
    expect(platformAuditSummary('tenant_created', { owner_email: 'ana@example.com' })).toBe(
      'Propietario: ana@example.com',
    )
  })
})
