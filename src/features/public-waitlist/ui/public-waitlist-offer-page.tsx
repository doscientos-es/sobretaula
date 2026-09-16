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
  cn,
} from '@doscientos/ui'
import { useState } from 'react'

import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

import { respondWaitlistOffer, type WaitlistOffer } from '../application/public-waitlist'
export function PublicWaitlistOfferPage({ offer, token }: { offer: WaitlistOffer; token: string }) {
  const locale = useLocale('es')
  const t = createTranslator(locale)
  const [result, setResult] = useState<'accepted' | 'declined' | 'unavailable' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const available = offer.status === 'offered'
  async function respond(accept: boolean) {
    if (busy) return
    setBusy(true)
    setError(false)
    try {
      const response = await respondWaitlistOffer({ data: { token, accept } })
      setResult(response.ok ? (accept ? 'accepted' : 'declined') : 'unavailable')
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="mx-auto max-w-lg space-y-6">
      <PageHeader>
        <PageHeaderTitle>{t('public.waitlist.title')}</PageHeaderTitle>
        <PageHeaderDescription>{t('public.waitlist.description')}</PageHeaderDescription>
      </PageHeader>
      <Card aria-busy={busy}>
        <CardHeader>
          <CardTitle>
            {available
              ? `${offer.party_size ?? ''} ${offer.party_size === 1 ? t('public.people.single') : t('public.people.multiple')}`
              : t('public.waitlist.unavailable')}
          </CardTitle>
          <CardDescription>
            {available && offer.requested_for
              ? new Date(offer.requested_for).toLocaleString()
              : t('public.waitlist.expired')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <p
              aria-live="polite"
              className={cn('rounded-lg border p-3 text-sm', {
                'border-border bg-muted/50 text-foreground': result !== 'accepted',
                'border-success/30 bg-success/10 text-success': result === 'accepted',
              })}
            >
              {t(`public.waitlist.${result}`)}
            </p>
          ) : available ? (
            <div className="space-y-3">
              {error ? (
                <p aria-live="assertive" className="text-destructive text-sm" role="alert">
                  {t('public.waitlist.failed')}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void respond(true)} type="button">
                  {busy ? t('public.waitlist.busy') : t('public.waitlist.accept')}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void respond(false)}
                  type="button"
                  variant="outline"
                >
                  {t('public.waitlist.decline')}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{t('public.waitlist.help')}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('public.waitlist.help')}</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
