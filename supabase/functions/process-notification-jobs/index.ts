import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Job = {
  id: string
  channel: 'email' | 'sms' | 'whatsapp'
  guest_id: string | null
  reservation_id: string | null
  type: string
}

type Reservation = {
  ends_at: string
  guest_id: string | null
  party_size: number
  starts_at: string
  tenant_id: string
  venue_id: string
}

type Guest = { email: string | null; full_name: string; locale: string }
type Venue = { name: string }
type Tenant = { name: string; timezone: string }
type Branding = {
  email_from_name: string
  logo_url: string | null
  primary_color: string
  reply_to_email: string | null
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character,
  )
}

function emailHtml({
  branding,
  guest,
  reservation,
  tenant,
  venue,
}: {
  branding: Branding
  guest: Guest
  reservation: Reservation
  tenant: Tenant
  venue: Venue
}): string {
  const locale = guest.locale === 'ca' ? 'ca-ES' : 'es-ES'
  const startsAt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: tenant.timezone,
  }).format(new Date(reservation.starts_at))
  const name = escapeHtml(branding.email_from_name || tenant.name)
  const logo = branding.logo_url
    ? `<img src="${escapeHtml(branding.logo_url)}" alt="${name}" style="display:block;max-height:48px;max-width:180px;" />`
    : `<p style="margin:0;color:${escapeHtml(branding.primary_color)};font-size:24px;font-weight:700;">${name}</p>`
  return `<!doctype html><html lang="${locale.slice(0, 2)}"><body style="margin:0;background:#f7f7f5;color:#1c1917;font-family:Arial,sans-serif;">
    <main style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <header style="border-top:6px solid ${escapeHtml(branding.primary_color)};padding:28px 32px 20px;">${logo}</header>
      <section style="padding:0 32px 32px;"><h1 style="margin:0 0 16px;font-size:24px;">Tu reserva está confirmada</h1>
        <p>Hola ${escapeHtml(guest.full_name)}, te esperamos en <strong>${escapeHtml(venue.name)}</strong>.</p>
        <div style="margin:24px 0;padding:20px;border-radius:12px;background:#f7f7f5;"><p style="margin:0 0 8px;"><strong>${escapeHtml(startsAt)}</strong></p>
          <p style="margin:0;">${reservation.party_size} ${reservation.party_size === 1 ? 'persona' : 'personas'}</p></div>
        <p style="margin:0;color:#57534e;font-size:14px;line-height:1.5;">Si necesitas hacer un cambio, responde a este correo o contacta con el restaurante.</p>
      </section></main></body></html>`
}

async function deliverEmail(job: Job): Promise<void> {
  if (!job.reservation_id || !job.guest_id) throw new Error('email_payload_missing_reservation_or_guest')
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .select('ends_at, guest_id, party_size, starts_at, tenant_id, venue_id')
    .eq('id', job.reservation_id)
    .maybeSingle<Reservation>()
  if (reservationError || !reservation) throw new Error('reservation_not_found')
  const [{ data: guest, error: guestError }, { data: venue, error: venueError }, { data: tenant, error: tenantError }, { data: branding }]
    = await Promise.all([
      supabase.from('guests').select('email, full_name, locale').eq('id', reservation.guest_id).maybeSingle<Guest>(),
      supabase.from('venues').select('name').eq('id', reservation.venue_id).maybeSingle<Venue>(),
      supabase.from('tenants').select('name, timezone').eq('id', reservation.tenant_id).maybeSingle<Tenant>(),
      supabase
        .from('tenant_email_branding')
        .select('email_from_name, logo_url, primary_color, reply_to_email')
        .eq('tenant_id', reservation.tenant_id)
        .maybeSingle<Branding>(),
    ])
  if (guestError || !guest?.email || venueError || !venue || tenantError || !tenant)
    throw new Error('email_payload_not_available')

  const resolvedBranding: Branding = branding ?? {
    email_from_name: tenant.name,
    logo_url: null,
    primary_color: '#0f766e',
    reply_to_email: null,
  }
  const apiKey = requiredEnv('RESEND_API_KEY')
  const fromEmail = requiredEnv('RESEND_FROM_EMAIL')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'idempotency-key': `reservation-notification-${job.id}`,
    },
    body: JSON.stringify({
      from: `${resolvedBranding.email_from_name} <${fromEmail}>`,
      html: emailHtml({ branding: resolvedBranding, guest, reservation, tenant, venue }),
      reply_to: resolvedBranding.reply_to_email ?? undefined,
      subject: `Reserva confirmada · ${venue.name}`,
      text: `Hola ${guest.full_name}, tu reserva en ${venue.name} está confirmada para ${reservation.starts_at}. Personas: ${reservation.party_size}.`,
      to: [guest.email],
    }),
  })
  if (!response.ok) throw new Error(`resend_http_${response.status}`)
}

async function deliver(job: Job): Promise<void> {
  if (job.channel === 'email') return deliverEmail(job)
  throw new Error(`provider_not_configured:${job.channel}`)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${Deno.env.get('NOTIFICATION_WORKER_TOKEN')}`)
    return new Response('Unauthorized', { status: 401 })
  const { data: jobs, error } = await supabase.rpc('claim_reservation_notification_jobs', {
    p_limit: 25,
  })
  if (error) return new Response('Claim failed', { status: 500 })
  const results: Array<{ id: string; ok: boolean }> = []
  for (const job of (jobs ?? []) as Job[]) {
    try {
      await deliver(job)
      await supabase.rpc('finish_reservation_notification_job', { p_id: job.id, p_succeeded: true })
      results.push({ id: job.id, ok: true })
    } catch (deliveryError) {
      const safeMessage =
        deliveryError instanceof Error ? deliveryError.message.slice(0, 200) : 'delivery_failed'
      await supabase.rpc('finish_reservation_notification_job', {
        p_id: job.id,
        p_succeeded: false,
        p_error: safeMessage,
      })
      results.push({ id: job.id, ok: false })
    }
  }
  return Response.json({
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
  })
})
