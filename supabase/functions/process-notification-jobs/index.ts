import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Job = {
  id: string
  channel: 'email' | 'sms' | 'whatsapp'
  guest_id: string | null
  reservation_id: string | null
  type: string
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))

async function deliver(job: Job): Promise<void> {
  const endpoint = Deno.env.get(`NOTIFICATION_${job.channel.toUpperCase()}_URL`)
  if (!endpoint) throw new Error(`provider_not_configured:${job.channel}`)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${Deno.env.get('NOTIFICATION_PROVIDER_TOKEN') ?? ''}`, 'content-type': 'application/json' },
    body: JSON.stringify({ guestId: job.guest_id, reservationId: job.reservation_id, type: job.type }),
  })
  if (!response.ok) throw new Error(`provider_http_${response.status}`)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${Deno.env.get('NOTIFICATION_WORKER_TOKEN')}`)
    return new Response('Unauthorized', { status: 401 })
  const { data: jobs, error } = await supabase.rpc('claim_reservation_notification_jobs', { p_limit: 25 })
  if (error) return new Response('Claim failed', { status: 500 })
  const results: Array<{ id: string; ok: boolean }> = []
  for (const job of (jobs ?? []) as Job[]) {
    try {
      await deliver(job)
      await supabase.rpc('finish_reservation_notification_job', { p_id: job.id, p_succeeded: true })
      results.push({ id: job.id, ok: true })
    } catch (deliveryError) {
      const safeMessage = deliveryError instanceof Error ? deliveryError.message.slice(0, 200) : 'delivery_failed'
      await supabase.rpc('finish_reservation_notification_job', { p_id: job.id, p_succeeded: false, p_error: safeMessage })
      results.push({ id: job.id, ok: false })
    }
  }
  return Response.json({ processed: results.length, succeeded: results.filter((result) => result.ok).length })
})
