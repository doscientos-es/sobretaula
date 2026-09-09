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
        const supabase = createServiceSupabaseClient()
        const [generation, suspension] = await Promise.all([
          // Ejecutable diariamente: la unicidad por suscripción/período hace que
          // sólo se cree una factura para el último mes cerrado.
          supabase.rpc('generate_platform_month_end_invoices'),
          supabase.rpc('suspend_overdue_platform_subscriptions'),
        ])
        if (generation.error || suspension.error) {
          return new Response('Reconciliation failed', { status: 500 })
        }
        return Response.json({
          generatedFiscalInvoices: generation.data ?? 0,
          suspendedTenants: suspension.data ?? 0,
        })
      },
    },
  },
})
