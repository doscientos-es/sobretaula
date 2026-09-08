import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  isRedsysSuccess,
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
  const { data, error } = await createServiceSupabaseClient().rpc(
    'process_platform_redsys_notification',
    {
      p_merchant_order: notification.merchantOrder,
      p_payload_sha256: redsysPayloadSha256(merchantParameters),
      p_provider_event_key: redsysPayloadSha256(
        `${merchantParameters}:${notification.responseCode}`,
      ),
      p_response_code: notification.responseCode,
      p_succeeded: isRedsysSuccess(notification.responseCode),
    },
  )
  if (error || !data)
    throw new Error(`platform_redsys_notification_process_failed:${error?.code ?? 'unknown'}`)
  return data as 'already_settled' | 'duplicate' | 'failed' | 'succeeded' | 'unknown_order'
}
