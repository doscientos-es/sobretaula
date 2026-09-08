import { describe, expect, it } from 'vitest'

import { resolveVenue, type Venue } from './venue'

const venues: Venue[] = [
  { id: '1', isActive: true, name: 'Centro', slug: 'centro' },
  { id: '2', isActive: true, name: 'Puerto', slug: 'puerto' },
]

describe('resolveVenue', () => {
  it('falls back to the first local when no slug is addressed', () => {
    expect(resolveVenue(venues, null)?.slug).toBe('centro')
  })

  it('returns the addressed local', () => {
    expect(resolveVenue(venues, 'puerto')?.slug).toBe('puerto')
  })

  it('returns null for an unreachable local', () => {
    expect(resolveVenue(venues, 'playa')).toBeNull()
  })

  it('returns null when the tenant has no locals yet', () => {
    expect(resolveVenue([], null)).toBeNull()
  })
})
