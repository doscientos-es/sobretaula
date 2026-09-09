import { describe, expect, it } from 'vitest'

import { canAssignTeamRole, canManageTeamMember } from './team'

describe('team role hierarchy', () => {
  it('allows an owner to assign every non-owner role', () => {
    expect(canAssignTeamRole('owner', 'manager')).toBe(true)
    expect(canAssignTeamRole('owner', 'waiter')).toBe(true)
  })

  it('limits managers to operational staff', () => {
    expect(canAssignTeamRole('manager', 'manager')).toBe(false)
    expect(canAssignTeamRole('manager', 'host')).toBe(true)
  })

  it('never lets the normal UI manage an owner or itself', () => {
    expect(
      canManageTeamMember({
        actorId: 'owner', actorRole: 'owner', targetId: 'owner', targetRole: 'owner',
      }),
    ).toBe(false)
  })
})