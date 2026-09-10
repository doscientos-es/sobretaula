import { describe, expect, it, vi } from 'vitest'

import { resolveUserDestinations } from './get-user-destinations'

describe('resolveUserDestinations', () => {
  it('does not resolve tenant memberships for a platform member', async () => {
    const loadTenants = vi.fn(async () => {
      throw new Error('tenant query should not run')
    })

    await expect(resolveUserDestinations(true, loadTenants)).resolves.toEqual({
      isPlatformMember: true,
      tenants: [],
    })
    expect(loadTenants).not.toHaveBeenCalled()
  })

  it('resolves tenant destinations for a non-platform user', async () => {
    const tenants = [{ name: 'Can Pere', slug: 'can-pere' }]

    await expect(resolveUserDestinations(false, async () => tenants)).resolves.toEqual({
      isPlatformMember: false,
      tenants,
    })
  })
})
