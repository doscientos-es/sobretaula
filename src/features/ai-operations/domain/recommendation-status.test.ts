import { describe, expect, it } from 'vitest'

import { canChangeRecommendationStatus } from './recommendation-status'
describe('recommendation status', () => {
  it('allows a pending decision', () =>
    expect(canChangeRecommendationStatus('pending', 'accepted')).toBe(true))
  it('keeps decisions immutable', () =>
    expect(canChangeRecommendationStatus('accepted', 'ignored')).toBe(false))
})
