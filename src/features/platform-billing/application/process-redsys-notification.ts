import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  encryptRedsysReference,
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
    .select(
      'id, payment_method_id, invoice:platform_billing_invoices!inner(tenant_id, subscription_id, total_cents)',
    )
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

  const succeeded = isRedsysSuccess(notification.responseCode)
  if (succeeded && !notification.identifier) {
    throw new Error('redsys_payment_reference_missing')
  }

  const { data, error } = await supabase.rpc('process_platform_redsys_notification', {
    p_merchant_order: notification.merchantOrder,
    p_payload_sha256: redsysPayloadSha256(merchantParameters),
    p_provider_event_key: redsysPayloadSha256(`${merchantParameters}:${notification.responseCode}`),
    p_response_code: notification.responseCode,
    p_succeeded: succeeded,
  })
  if (error || !data)
    throw new Error(`platform_redsys_notification_process_failed:${error?.code ?? 'unknown'}`)
  if (succeeded && notification.identifier && !attempt.payment_method_id) {
    const encryptionKey = process.env.PLATFORM_PAYMENT_REFERENCE_ENCRYPTION_KEY?.trim()
    if (!encryptionKey) throw new Error('missing_platform_payment_reference_encryption_key')

    const { data: paymentMethod, error: paymentMethodError } = await supabase
      .from('platform_payment_methods')
      .insert({
        display_label: 'Redsys',
        is_default: false,
        provider: 'redsys',
        provider_reference_ciphertext: `\\x${encryptRedsysReference(notification.identifier, encryptionKey).toString('hex')}`,
        status: 'active',
        tenant_id: invoice.tenant_id,
      })
      .select('id')
      .single()
    if (paymentMethodError || !paymentMethod)
      throw new Error(
        `platform_payment_method_create_failed:${paymentMethodError?.code ?? 'unknown'}`,
      )

    const { error: defaultMethodError } = await supabase
      .from('platform_payment_methods')
      .update({ is_default: false })
      .eq('tenant_id', invoice.tenant_id)
      .eq('status', 'active')
      .neq('id', paymentMethod.id)
    if (defaultMethodError)
      throw new Error(`platform_payment_method_default_reset_failed:${defaultMethodError.code}`)

    const { error: activateMethodError } = await supabase
      .from('platform_payment_methods')
      .update({ is_default: true })
      .eq('id', paymentMethod.id)
    if (activateMethodError)
      throw new Error(`platform_payment_method_default_set_failed:${activateMethodError.code}`)

    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({ payment_method_id: paymentMethod.id })
      .eq('id', invoice.subscription_id)
    if (subscriptionError)
      throw new Error(`platform_subscription_payment_method_link_failed:${subscriptionError.code}`)

    const { error: attemptMethodError } = await supabase
      .from('platform_payment_attempts')
      .update({ payment_method_id: paymentMethod.id })
      .eq('id', attempt.id)
    if (attemptMethodError)
      throw new Error(`platform_payment_attempt_method_link_failed:${attemptMethodError.code}`)
  }
  return data as 'already_settled' | 'duplicate' | 'failed' | 'succeeded' | 'unknown_order'
}
