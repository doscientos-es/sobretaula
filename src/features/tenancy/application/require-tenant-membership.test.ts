import { describe, expect, it } from 'vitest'

import { validateTenantMembershipInput } from './require-tenant-membership'

describe('validateTenantMembershipInput', () => {
  it('keeps the server-function payload after validating its tenant address', () => {
    expect(
      validateTenantMembershipInput({
        email: 'ana@example.com',
        name: 'Ana García',
        role: 'waiter',
        tenantId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toMatchObject({
      email: 'ana@example.com',
      name: 'Ana García',
      role: 'waiter',
      tenantId: '00000000-0000-4000-8000-000000000001',
    })
  })
})
