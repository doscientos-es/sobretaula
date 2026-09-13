import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Job = {
  id: string
  channel: 'email' | 'sms' | 'whatsapp' | 'push'
  guest_id: string | null
  recipient_user_id: string | null
  reservation_id: string | null
  type: string
}

type Reservation = {
  ends_at: string
  guest_id: string | null
  party_size: number
  status: string
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
type PushSubscription = { auth_key: string; endpoint: string; p256dh_key: string }

const encoder = new TextEncoder()

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

function base64UrlEncode(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function concatBytes(...values: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(values.reduce((length, value) => length + value.length, 0))
  let offset = 0
  for (const value of values) {
    result.set(value, offset)
    offset += value.length
  }
  return result
}

async function hmac(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let previous = new Uint8Array()
  for (
    let index = 1;
    chunks.reduce((total, chunk) => total + chunk.length, 0) < length;
    index += 1
  ) {
    previous = await hmac(prk, concatBytes(previous, info, new Uint8Array([index])))
    chunks.push(previous)
  }
  return concatBytes(...chunks).slice(0, length)
}

function vapidPublicJwk(publicKey: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('invalid_vapid_public_key')
  return {
    crv: 'P-256',
    kty: 'EC',
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
  }
}

async function signVapidToken(
  endpoint: string,
): Promise<{ authorization: string; publicKey: string }> {
  const publicKeyValue = requiredEnv('VAPID_PUBLIC_KEY')
  const privateKeyValue = requiredEnv('VAPID_PRIVATE_KEY')
  const publicKey = base64UrlDecode(publicKeyValue)
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    {
      ...vapidPublicJwk(publicKey),
      d: base64UrlEncode(base64UrlDecode(privateKeyValue)),
      ext: false,
    },
    { crv: 'P-256', name: 'ECDSA' },
    false,
    ['sign'],
  )
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })))
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: requiredEnv('VAPID_SUBJECT'),
      }),
    ),
  )
  const input = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    { hash: 'SHA-256', name: 'ECDSA' },
    privateKey,
    encoder.encode(input),
  )
  return {
    authorization: `vapid t=${input}.${base64UrlEncode(signature)}, k=${publicKeyValue}`,
    publicKey: publicKeyValue,
  }
}

async function encryptPushPayload(
  subscription: PushSubscription,
  payload: string,
): Promise<Uint8Array> {
  const subscriberPublicKeyBytes = base64UrlDecode(subscription.p256dh_key)
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKeyBytes,
    { crv: 'P-256', name: 'ECDH' },
    false,
    [],
  )
  const ephemeral = (await crypto.subtle.generateKey({ crv: 'P-256', name: 'ECDH' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const ephemeralPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey),
  )
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberPublicKey },
      ephemeral.privateKey,
      256,
    ),
  )
  const authSecret = base64UrlDecode(subscription.auth_key)
  const authInfo = concatBytes(
    encoder.encode('WebPush: info\0'),
    subscriberPublicKeyBytes,
    ephemeralPublicKey,
  )
  const authPrk = await hmac(authSecret, sharedSecret)
  const ikm = await hkdfExpand(authPrk, authInfo, 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12)
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const plaintext = concatBytes(encoder.encode(payload), new Uint8Array([2]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ iv: nonce, name: 'AES-GCM' }, aesKey, plaintext),
  )
  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, 4096)
  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([ephemeralPublicKey.length]),
    ephemeralPublicKey,
    ciphertext,
  )
}

const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  )
}

function emailHtml({
  branding,
  guest,
  isReminder,
  reservation,
  tenant,
  venue,
}: {
  branding: Branding
  guest: Guest
  isReminder: boolean
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
  const heading = isReminder ? 'Te esperamos mañana' : 'Tu reserva está confirmada'
  const intro = isReminder
    ? 'Este es un recordatorio de tu próxima reserva.'
    : `Hola ${escapeHtml(guest.full_name)}, te esperamos en <strong>${escapeHtml(venue.name)}</strong>.`
  return `<!doctype html><html lang="${locale.slice(0, 2)}"><body style="margin:0;background:#f7f7f5;color:#1c1917;font-family:Arial,sans-serif;">
    <main style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <header style="border-top:6px solid ${escapeHtml(branding.primary_color)};padding:28px 32px 20px;">${logo}</header>
      <section style="padding:0 32px 32px;"><h1 style="margin:0 0 16px;font-size:24px;">${heading}</h1>
        <p>${intro}</p>
        <div style="margin:24px 0;padding:20px;border-radius:12px;background:#f7f7f5;"><p style="margin:0 0 8px;"><strong>${escapeHtml(startsAt)}</strong></p>
          <p style="margin:0;">${reservation.party_size} ${reservation.party_size === 1 ? 'persona' : 'personas'}</p></div>
        <p style="margin:0;color:#57534e;font-size:14px;line-height:1.5;">Si necesitas hacer un cambio, responde a este correo o contacta con el restaurante.</p>
      </section></main></body></html>`
}

async function deliverEmail(job: Job): Promise<'sent' | 'cancelled'> {
  if (!job.reservation_id || !job.guest_id)
    throw new Error('email_payload_missing_reservation_or_guest')
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .select('ends_at, guest_id, party_size, starts_at, status, tenant_id, venue_id')
    .eq('id', job.reservation_id)
    .maybeSingle<Reservation>()
  if (reservationError || !reservation) throw new Error('reservation_not_found')
  if (
    job.type === 'reminder' &&
    (!['pending', 'confirmed'].includes(reservation.status) ||
      new Date(reservation.starts_at).getTime() <= Date.now())
  )
    return 'cancelled'
  const [
    { data: guest, error: guestError },
    { data: venue, error: venueError },
    { data: tenant, error: tenantError },
    { data: branding },
  ] = await Promise.all([
    supabase
      .from('guests')
      .select('email, full_name, locale')
      .eq('id', reservation.guest_id)
      .maybeSingle<Guest>(),
    supabase.from('venues').select('name').eq('id', reservation.venue_id).maybeSingle<Venue>(),
    supabase
      .from('tenants')
      .select('name, timezone')
      .eq('id', reservation.tenant_id)
      .maybeSingle<Tenant>(),
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
      html: emailHtml({
        branding: resolvedBranding,
        guest,
        isReminder: job.type === 'reminder',
        reservation,
        tenant,
        venue,
      }),
      reply_to: resolvedBranding.reply_to_email ?? undefined,
      subject: `${job.type === 'reminder' ? 'Recordatorio de reserva' : 'Reserva confirmada'} · ${venue.name}`,
      text: `${job.type === 'reminder' ? `Te esperamos mañana en ${venue.name}` : `Hola ${guest.full_name}, tu reserva en ${venue.name} está confirmada`} para ${reservation.starts_at}. Personas: ${reservation.party_size}.`,
      to: [guest.email],
    }),
  })
  if (!response.ok) throw new Error(`resend_http_${response.status}`)
  return 'sent'
}

async function deliverPush(job: Job): Promise<'sent' | 'cancelled'> {
  if (!job.reservation_id || !job.recipient_user_id)
    throw new Error('push_payload_missing_reservation_or_recipient')
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .select('ends_at, guest_id, party_size, starts_at, status, tenant_id, venue_id')
    .eq('id', job.reservation_id)
    .maybeSingle<Reservation>()
  if (reservationError || !reservation) throw new Error('reservation_not_found')
  if (!['pending', 'confirmed'].includes(reservation.status)) return 'cancelled'

  const [
    { data: subscriptions, error: subscriptionsError },
    { data: venue, error: venueError },
    { data: tenant, error: tenantError },
  ] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('auth_key, endpoint, p256dh_key')
      .eq('user_id', job.recipient_user_id)
      .returns<PushSubscription[]>(),
    supabase.from('venues').select('name').eq('id', reservation.venue_id).maybeSingle<Venue>(),
    supabase
      .from('tenants')
      .select('name, timezone')
      .eq('id', reservation.tenant_id)
      .maybeSingle<Tenant>(),
  ])
  if (subscriptionsError || venueError || !venue || tenantError || !tenant)
    throw new Error('push_payload_not_available')
  if (!subscriptions?.length) return 'cancelled'

  const startsAt = new Intl.DateTimeFormat(job.locale === 'ca' ? 'ca-ES' : 'es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: tenant.timezone,
  }).format(new Date(reservation.starts_at))
  const payload = JSON.stringify({
    body: `Nueva reserva en ${venue.name}: ${reservation.party_size} ${reservation.party_size === 1 ? 'persona' : 'personas'} · ${startsAt}`,
    tag: `reservation-${reservation.tenant_id}`,
    title: 'Nueva reserva',
    url: '/',
  })
  let delivered = 0
  for (const subscription of subscriptions) {
    const { authorization } = await signVapidToken(subscription.endpoint)
    const response = await fetch(subscription.endpoint, {
      body: await encryptPushPayload(subscription, payload),
      headers: {
        authorization,
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        ttl: '300',
      },
      method: 'POST',
    })
    if (response.status === 404 || response.status === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      continue
    }
    if (!response.ok) throw new Error(`push_provider_http_${response.status}`)
    delivered += 1
  }
  return delivered ? 'sent' : 'cancelled'
}

async function deliver(job: Job): Promise<'sent' | 'cancelled'> {
  if (job.channel === 'email') return deliverEmail(job)
  if (job.channel === 'push') return deliverPush(job)
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
  const results: Array<{ cancelled: boolean; id: string; sent: boolean }> = []
  for (const job of (jobs ?? []) as Job[]) {
    try {
      const outcome = await deliver(job)
      if (outcome === 'cancelled') {
        const { error: cancelError } = await supabase.rpc('cancel_reservation_notification_job', {
          p_id: job.id,
          p_reason: 'reservation_not_eligible',
        })
        if (cancelError) throw cancelError
      } else {
        const { error: finishError } = await supabase.rpc('finish_reservation_notification_job', {
          p_id: job.id,
          p_succeeded: true,
        })
        if (finishError) throw finishError
      }
      results.push({ cancelled: outcome === 'cancelled', id: job.id, sent: outcome === 'sent' })
    } catch (deliveryError) {
      const safeMessage =
        deliveryError instanceof Error ? deliveryError.message.slice(0, 200) : 'delivery_failed'
      await supabase.rpc('finish_reservation_notification_job', {
        p_id: job.id,
        p_succeeded: false,
        p_error: safeMessage,
      })
      results.push({ cancelled: false, id: job.id, sent: false })
    }
  }
  return Response.json({
    cancelled: results.filter((result) => result.cancelled).length,
    processed: results.length,
    succeeded: results.filter((result) => result.sent).length,
  })
})
