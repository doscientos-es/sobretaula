import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const subscriptionInput = z.object({
  auth: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(256),
  endpoint: z.string().url().max(2048),
  p256dh: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(256),
  userAgent: z.string().max(512).optional(),
})

export const getPushNotificationConfig = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => ({
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  }))

export const savePushSubscription = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(subscriptionInput)
  .handler(async ({ context, data }) => {
    const { error } = await createRequestSupabaseClient(context.principal.accessToken)
      .from('push_subscriptions')
      .upsert(
        {
          auth_key: data.auth,
          endpoint: data.endpoint,
          p256dh_key: data.p256dh,
          user_agent: data.userAgent ?? null,
          user_id: context.principal.userId,
        },
        { onConflict: 'user_id,endpoint' },
      )
    if (error) throw new Error(`push_subscription_save_failed:${error.code}`)
    return { ok: true as const }
  })

export const removePushSubscription = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ endpoint: z.string().url().max(2048) }))
  .handler(async ({ context, data }) => {
    const { error } = await createRequestSupabaseClient(context.principal.accessToken)
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', data.endpoint)
      .eq('user_id', context.principal.userId)
    if (error) throw new Error(`push_subscription_remove_failed:${error.code}`)
    return { ok: true as const }
  })
