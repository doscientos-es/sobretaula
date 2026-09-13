import { describe, expect, it } from 'vitest'

import { recommendStaffing } from './staffing-recommendation'
describe('recommendStaffing', () => {
  it('recommends additional staff', () =>
    expect(
      recommendStaffing({
        expectedCovers: 86,
        currentStaff: 4,
        coversPerStaff: 18,
        minimumStaff: 2,
      }),
    ).toMatchObject({ recommendedStaff: 5, delta: 1 }))
  it('respects the minimum', () =>
    expect(
      recommendStaffing({
        expectedCovers: 10,
        currentStaff: 4,
        coversPerStaff: 20,
        minimumStaff: 3,
      }).recommendedStaff,
    ).toBe(3))
})
