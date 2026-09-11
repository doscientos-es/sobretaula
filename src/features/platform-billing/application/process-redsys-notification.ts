import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  isRedsysSuccess,
  readRedsysConfig,
  redsysPayloadSha256,
  type RedsysNotification,
} from '../infrastructure/server/redsys'

/** Applies a verified payment outcome through the database transaction/RPC. */
export async function processRedsysNotification({
  merchantParameters,
  notification,
}: {
  merchantParameters: string
  notification: RedsysNotification
}): Promise<'already_settled' | 'duplicate' | 'failed' | 'succeeded' | 'unknown_order'> {
  const supabase = createServiceSupabaseClient()
  const { data: attempt, error: attemptError } = await supabase
    .from('platform_payment_attempts')
    .select('id, invoice:platform_billing_invoices!inner(total_cents)')
    .eq('provider', 'redsys')
    .eq('merchant_order', notification.merchantOrder)
    .maybeSingle()
  if (attemptError) throw new Error(`platform_redsys_attempt_lookup_failed:${attemptError.code}`)
  if (!attempt) return 'unknown_order'
  const invoice = Array.isArray(attempt.invoice) ? attempt.invoice[0] : attempt.invoice
  if (!invoice || Number(invoice.total_cents) !== notification.amountCents)
    throw new Error('platform_redsys_amount_mismatch')

  const config = readRedsysConfig()
  if (
    notification.merchantCode !== config.merchantCode ||
    notification.terminal !== config.terminal ||
    notification.currency !== config.currency
  )
    throw new Error('platform_redsys_context_mismatch')

  const { data, error } = await supabase.rpc('process_platform_redsys_notification', {
    p_merchant_order: notification.merchantOrder,
    p_payload_sha256: redsysPayloadSha256(merchantParameters),
    p_provider_event_key: redsysPayloadSha256(`${merchantParameters}:${notification.responseCode}`),
    p_response_code: notification.responseCode,
    p_succeeded: isRedsysSuccess(notification.responseCode),
  })
  if (error || !data)
    throw new Error(`platform_redsys_notification_process_failed:${error?.code ?? 'unknown'}`)
  if (notification.identifier) {
    await supabase
      .from('platform_payment_attempts')
      .update({ provider_reference: notification.identifier })
      .eq('id', attempt.id)
  }
  return data as 'already_settled' | 'duplicate' | 'failed' | 'succeeded' | 'unknown_order'
}
