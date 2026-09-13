import { describe, expect, it } from 'vitest'

import { classifyGuest } from './guest-segments'
describe('classifyGuest', () => {
  it('identifies inactive guests first', () =>
    expect(classifyGuest({ visits: 20, spendCents: 200000, daysSinceLastVisit: 120 })).toBe(
      'inactivo',
    ))
  it('identifies habitual guests', () =>
    expect(classifyGuest({ visits: 4, spendCents: 2000, daysSinceLastVisit: 10 })).toBe('habitual'))
  it('identifies new guests', () =>
    expect(classifyGuest({ visits: 1, spendCents: 1000, daysSinceLastVisit: 4 })).toBe('nuevo'))
})
