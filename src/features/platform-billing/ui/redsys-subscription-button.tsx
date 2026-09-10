import { Button } from '@doscientos/ui'
import { useState } from 'react'

import { createSubscriptionPayment } from '../application/create-subscription-payment'

export function RedsysSubscriptionButton({ tenantId }: { tenantId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setError(null)
    try {
      const payment = await createSubscriptionPayment({ data: { tenantId } })
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = payment.url
      for (const [name, value] of Object.entries({
        Ds_SignatureVersion: payment.signatureVersion,
        Ds_MerchantParameters: payment.merchantParameters,
        Ds_Signature: payment.signature,
      })) {
        const input = document.createElement('input')
        input.name = name
        input.type = 'hidden'
        input.value = value
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
    } catch {
      setError('No se ha podido iniciar el pago. Inténtalo de nuevo.')
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button disabled={pending} onClick={start} size="lg">
        {pending ? 'Preparando pago…' : 'Autorizar pago seguro'}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
