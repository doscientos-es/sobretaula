import { describe, expect, it } from 'vitest'

import { canAdvanceCampaign } from './campaign-status'
describe('campaign status', () => {
  it('allows controlled lifecycle transitions', () => {
    expect(canAdvanceCampaign('draft', 'sent')).toBe(true)
    expect(canAdvanceCampaign('sent', 'draft')).toBe(false)
  })
})
