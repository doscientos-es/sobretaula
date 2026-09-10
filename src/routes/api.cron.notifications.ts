import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/cron/notifications')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.NOTIFICATION_CRON_SECRET
        if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`)
          return new Response('Unauthorized', { status: 401 })
        const supabaseUrl = process.env.SUPABASE_URL
        const workerToken = process.env.NOTIFICATION_WORKER_TOKEN
        if (!supabaseUrl || !workerToken)
          return new Response('Worker not configured', { status: 503 })
        const response = await fetch(`${supabaseUrl}/functions/v1/process-notification-jobs`, {
          method: 'POST',
          headers: { authorization: `Bearer ${workerToken}` },
        })
        return new Response(await response.text(), {
          status: response.status,
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
