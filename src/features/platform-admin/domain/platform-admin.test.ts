import { describe, expect, it } from 'vitest'

import { canManagePlatformOperator, isManagedTenantStatus } from './platform-admin'

describe('platform administration safeguards', () => {
  it('never permits an owner to manage their own platform access', () => {
    expect(
      canManagePlatformOperator({
        actorId: 'owner-1',
        ownerCount: 2,
        targetId: 'owner-1',
        targetRole: 'platform_owner',
      }),
    ).toBe(false)
  })

  it('preserves access for the only platform owner', () => {
    expect(
      canManagePlatformOperator({
        actorId: 'owner-1',
        ownerCount: 1,
        targetId: 'owner-2',
        targetRole: 'platform_owner',
      }),
    ).toBe(false)
  })

  it('allows managing support and a non-last owner', () => {
    expect(
      canManagePlatformOperator({
        actorId: 'owner-1',
        ownerCount: 2,
        targetId: 'support-1',
        targetRole: 'platform_support',
      }),
    ).toBe(true)
    expect(
      canManagePlatformOperator({
        actorId: 'owner-1',
        ownerCount: 2,
        targetId: 'owner-2',
        targetRole: 'platform_owner',
      }),
    ).toBe(true)
  })

  it.each(['active', 'suspended'])('allows manual status %s', (status) => {
    expect(isManagedTenantStatus(status)).toBe(true)
  })

  it.each(['setup_pending', 'trial', 'other'])('rejects automatic status %s', (status) => {
    expect(isManagedTenantStatus(status)).toBe(false)
  })
})
