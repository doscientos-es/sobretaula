import { describe, expect, it } from 'vitest'

import { isAuthEmailRateLimited, isInvitationEmailRateLimited } from './auth-email-rate-limit'

describe('Supabase Auth email rate limits', () => {
  it('recognizes Auth rate-limit status and code', () => {
    expect(isAuthEmailRateLimited({ status: 429 })).toBe(true)
    expect(isAuthEmailRateLimited({ code: 'over_email_send_rate_limit' })).toBe(true)
  })

  it('only recognizes rate-limited invitation responses', () => {
    expect(isInvitationEmailRateLimited(new Response(null, { status: 429 }))).toBe(true)
    expect(isInvitationEmailRateLimited(new Response(null, { status: 400 }))).toBe(false)
  })
})
