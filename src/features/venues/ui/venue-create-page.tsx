import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { EXTRA_VENUE_MONTHLY_NET_CENTS } from '@/features/platform-billing'
import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { formatMoney } from '@/shared/lib/money/money'
import { venueSlugCandidate } from '@/shared/lib/tenant/venue-slug'

import { createVenue } from '../application/venues'

/** Alta de un local adicional: el coste mensual se anuncia antes de crearlo. */
export function VenueCreatePage({
  locale,
  tenantId,
  tenantSlug,
}: {
  locale: Locale
  tenantId: string
  tenantSlug: string
}) {
  const t = createTranslator(locale)
  const feedback = useFormFeedback()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  function changeName(value: string) {
    setName(value)
    if (!slugEdited) setSlug(venueSlugCandidate(value))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    try {
      const venue = await createVenue({ data: { name, slug, tenantId } })
      window.location.assign(`/t/${tenantSlug}/l/${venue.slug}`)
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? 'Esta dirección de local ya está en uso.'
          : 'No se ha podido crear el local. Revisa los datos e inténtalo de nuevo.',
      )
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('venue.create.title')}</PageHeaderTitle>
          <PageHeaderDescription>
            Añade un nuevo espacio y mantén cada local organizado desde el mismo lugar.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t('venue.create.title')}</CardTitle>
          <CardDescription>
            {`Cada local adicional suma ${formatMoney(EXTRA_VENUE_MONTHLY_NET_CENTS, locale)} al mes, sin IVA.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            <Field>
              <FieldLabel htmlFor="venue-name">Nombre del local</FieldLabel>
              <Input
                id="venue-name"
                onChange={(event) => changeName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="venue-slug">Dirección del local</FieldLabel>
              <Input
                id="venue-slug"
                onChange={(event) => {
                  setSlugEdited(true)
                  setSlug(event.target.value)
                }}
                pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
                required
                value={slug}
              />
            </Field>
            <FormFeedback pendingLabel="Creando local…" state={feedback.state} />
            <Button disabled={feedback.pending} type="submit">
              {t('venue.create.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
