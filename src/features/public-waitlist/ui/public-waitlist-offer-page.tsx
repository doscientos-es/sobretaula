import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { useState } from 'react'

import { respondWaitlistOffer, type WaitlistOffer } from '../application/public-waitlist'
export function PublicWaitlistOfferPage({ offer, token }: { offer: WaitlistOffer; token: string }) {
  const [result, setResult] = useState<string | null>(null)
  const available = offer.status === 'offered'
  async function respond(accept: boolean) {
    const response = await respondWaitlistOffer({ data: { token, accept } })
    setResult(
      response.ok
        ? accept
          ? '¡Listo! Hemos aceptado tu plaza.'
          : 'Hemos rechazado la oferta.'
        : 'Esta oferta ya no está disponible.',
    )
  }
  return (
    <section className="mx-auto max-w-lg space-y-6">
      <PageHeader>
        <PageHeaderTitle>Tu mesa está disponible</PageHeaderTitle>
        <PageHeaderDescription>Responde a esta oferta antes de que caduque.</PageHeaderDescription>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>
            {available ? `${offer.party_size ?? ''} comensales` : 'Oferta no disponible'}
          </CardTitle>
          <CardDescription>
            {available && offer.requested_for
              ? new Date(offer.requested_for).toLocaleString()
              : 'El enlace ha caducado o ya se ha utilizado.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <p aria-live="polite">{result}</p>
          ) : available ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void respond(true)} type="button">
                Aceptar plaza
              </Button>
              <Button onClick={() => void respond(false)} type="button" variant="outline">
                No, gracias
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Contacta con el restaurante si necesitas ayuda.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
