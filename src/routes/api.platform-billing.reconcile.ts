import { timingSafeEqual } from 'node:crypto'

import { createFileRoute } from '@tanstack/react-router'

import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

function isAuthorized(request: Request): boolean {
  const secret = process.env.PLATFORM_BILLING_CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!secret || !provided) return false
  const expected = Buffer.from(secret)
  const received = Buffer.from(provided)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export const Route = createFileRoute('/api/platform-billing/reconcile')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) return new Response('Unauthorized', { status: 401 })
        const { data, error } = await createServiceSupabaseClient().rpc(
          'suspend_overdue_platform_subscriptions',
        )
        if (error) return new Response('Reconciliation failed', { status: 500 })
        return Response.json({ suspendedTenants: data ?? 0 })
      },
    },
  },
})
