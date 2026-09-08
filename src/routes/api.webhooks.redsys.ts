import { createFileRoute } from '@tanstack/react-router'

import { processRedsysNotification } from '@/features/platform-billing/application/process-redsys-notification'
import {
  parseRedsysNotification,
  readRedsysConfig,
  verifyRedsysSignature,
} from '@/features/platform-billing/infrastructure/server/redsys'

export const Route = createFileRoute('/api/webhooks/redsys')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData()
        const merchantParameters = form.get('Ds_MerchantParameters')
        const signature = form.get('Ds_Signature')
        if (typeof merchantParameters !== 'string' || typeof signature !== 'string') {
          return new Response('Missing Redsys parameters', { status: 400 })
        }

        const config = readRedsysConfig()
        if (
          !verifyRedsysSignature({ merchantParameters, secretKey: config.secretKey, signature })
        ) {
          return new Response('Invalid Redsys signature', { status: 403 })
        }

        try {
          await processRedsysNotification({
            merchantParameters,
            notification: parseRedsysNotification(merchantParameters),
          })
          return new Response(null, { status: 204 })
        } catch {
          return new Response('Payment notification processing failed', { status: 500 })
        }
      },
    },
  },
})
