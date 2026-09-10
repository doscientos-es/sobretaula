import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { createPublicSupabaseClient } from '@/shared/lib/supabase/server/create-public-client'

const tokenInput = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) })
export type WaitlistOffer = {
  status: string
  party_size?: number
  requested_for?: string
  expires_at?: string
}
export const getWaitlistOffer = createServerFn({ method: 'GET' })
  .validator(tokenInput)
  .handler(async ({ data }): Promise<WaitlistOffer> => {
    const supabase = createPublicSupabaseClient()
    const { data: offer, error } = await supabase.rpc('get_waitlist_offer', {
      p_token_hash: data.token,
    })
    if (error) throw new Error(`waitlist_offer_load_failed:${error.code}`)
    return offer as WaitlistOffer
  })
export const respondWaitlistOffer = createServerFn({ method: 'POST' })
  .validator(z.object({ token: tokenInput.shape.token, accept: z.boolean() }))
  .handler(async ({ data }) => {
    const supabase = createPublicSupabaseClient()
    const { data: result, error } = await supabase.rpc('respond_waitlist_offer', {
      p_token_hash: data.token,
      p_accept: data.accept,
    })
    if (error) throw new Error(`waitlist_offer_response_failed:${error.code}`)
    return result as { ok: boolean; reason?: string; accepted?: boolean }
  })
