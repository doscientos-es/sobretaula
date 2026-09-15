import { describe, expect, it } from 'vitest'

import { tenantOnboardingStageStatus } from './tenant-onboarding-progress'

describe('tenant onboarding progress', () => {
  it('marks billing as active once the restaurant details have been completed', () => {
    expect(tenantOnboardingStageStatus(2, false)).toEqual(['done', 'active', 'upcoming'])
  })

  it('keeps billing active while the user reviews the data before creating the restaurant', () => {
    expect(tenantOnboardingStageStatus(3, false)).toEqual(['done', 'active', 'upcoming'])
  })

  it('marks activation as active only after the restaurant has been created', () => {
    expect(tenantOnboardingStageStatus(3, true)).toEqual(['done', 'done', 'active'])
  })
})
