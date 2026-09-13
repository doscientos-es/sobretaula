import { describe, expect, it } from 'vitest'

import { canRedeem, pointsForSpend } from './loyalty'

describe('loyalty', () => {
  it('awards one point per configured euro', () => expect(pointsForSpend(1250)).toBe(12))
  it('does not allow partial or invalid redemptions', () => {
    expect(canRedeem(100, 100)).toBe(true)
    expect(canRedeem(99, 100)).toBe(false)
    expect(canRedeem(100, 0)).toBe(false)
  })
})
