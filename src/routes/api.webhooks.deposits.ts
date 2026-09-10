import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/webhooks/deposits')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DEPOSIT_WEBHOOK_SECRET
        if (!secret || request.headers.get('x-webhook-secret') !== secret)
          return new Response('Unauthorized', { status: 401 })
        const payload = (await request.json()) as {
          provider?: string
          reference?: string
          status?: string
          paidAt?: string
        }
        if (!payload.provider || !payload.reference || !payload.status)
          return new Response('Invalid event', { status: 422 })
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } },
        )
        const { data, error } = await supabase.rpc('process_reservation_deposit_event', {
          p_provider: payload.provider,
          p_reference: payload.reference,
          p_status: payload.status,
          p_paid_at: payload.paidAt ?? null,
        })
        if (error) return new Response('Webhook processing failed', { status: 500 })
        return Response.json({ processed: data === true })
      },
    },
  },
})
