import { Button, cn } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CalendarCheck2, CircleAlert, MapPin } from 'lucide-react'
import { useRef, useState } from 'react'

import { LanguageSwitcher } from '@/shared/lib/i18n/language-switcher'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

import {
  cancelPublicReservation,
  reschedulePublicReservation,
  type PublicReservation,
} from '../application/public-reservations'
import { zonedLocalToIso } from '../domain/zoned-time'

function formatDateTime(value: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function currentLocalValue(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`
}

function localNowValue(timezone: string): string {
  return currentLocalValue(new Date().toISOString(), timezone)
}

export function PublicReservationManagementPage({
  reservation,
  token,
}: {
  reservation: PublicReservation
  token: string
}) {
  const locale = useLocale()
  const t = createTranslator(locale)
  const [current, setCurrent] = useState(reservation)
  const [busy, setBusy] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [newDate, setNewDate] = useState(() =>
    currentLocalValue(reservation.startsAt, reservation.timezone),
  )
  const cancelled = current.status === 'cancelled'

  async function cancel() {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await cancelPublicReservation({ data: { token } })
      if (!result.cancelled) {
        setError(t('public.cancelUnavailable'))
        return
      }
      setCurrent({ ...current, status: 'cancelled' })
      setSuccess(t('public.cancelled'))
      setConfirmingCancel(false)
    } catch {
      setError(t('public.cancelFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function reschedule() {
    const nextStartsAt = zonedLocalToIso(newDate, current.timezone)
    if (
      Number.isNaN(new Date(nextStartsAt).getTime()) ||
      newDate < localNowValue(current.timezone)
    ) {
      setError(t('public.rescheduleUnavailable'))
      setSuccess('')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await reschedulePublicReservation({
        data: { token, startsAt: nextStartsAt },
      })
      if (!result.rescheduled) {
        setError(t('public.rescheduleUnavailable'))
        return
      }
      setCurrent({ ...current, startsAt: nextStartsAt })
      setSuccess(t('public.rescheduleSaved'))
    } catch {
      setError(t('public.rescheduleFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-6">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      <section
        aria-busy={busy}
        aria-labelledby="manage-title"
        className="relative z-10 w-full max-w-xl rounded-3xl border border-[#292d34]/10 bg-white p-[clamp(2rem,7vw,5rem)] text-center shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)]"
      >
        <span
          aria-hidden="true"
          className={cn(
            'mx-auto grid size-16 place-items-center rounded-full text-white',
            cancelled ? 'bg-destructive' : 'bg-success',
          )}
        >
          {cancelled ? <CircleAlert className="size-7" /> : <CalendarCheck2 className="size-7" />}
        </span>
        <p className="mt-5 text-xs font-bold tracking-[0.14em] text-[#c34d3e] uppercase">
          {cancelled ? t('public.cancelled') : t('public.yourReservation')}
        </p>
        <h1
          className="mt-3 text-4xl font-[650] tracking-[-0.075em] text-[#292d34]"
          id="manage-title"
        >
          {current.tenantName}
        </h1>
        <p className="mt-5 text-[#60656d]">
          <MapPin aria-hidden="true" className="mr-1 inline size-4" />
          {current.venueName}
        </p>
        <p className="mt-2 text-[#60656d]">
          {formatDateTime(current.startsAt, current.timezone, locale)} · {current.partySize}{' '}
          {current.partySize === 1 ? t('public.people.single') : t('public.people.multiple')}
        </p>
        {busy && (
          <output aria-live="polite" className="text-muted-foreground mt-4 block text-sm">
            {t('public.waitlist.busy')}
          </output>
        )}
        {error && (
          <p aria-live="assertive" className="text-destructive mt-4">
            {error}
          </p>
        )}
        {success && (
          <p aria-live="polite" className="text-success mt-4 text-sm font-medium">
            {success}
          </p>
        )}
        {!cancelled && (
          <div className="mt-6 space-y-3 text-left">
            <label
              className="block text-sm font-semibold text-[#292d34]"
              htmlFor="new-reservation-time"
            >
              {t('public.changeDateTime')}
            </label>
            <input
              aria-label={t('public.newDateTime')}
              className="w-full rounded-xl border border-[#292d34]/15 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c34d3e]"
              id="new-reservation-time"
              ref={dateInputRef}
              onChange={(event) => {
                const value = event.target.value
                setNewDate(value)
                const next = new Date(zonedLocalToIso(value, current.timezone))
                setError(
                  value && (Number.isNaN(next.getTime()) || value < localNowValue(current.timezone))
                    ? t('public.rescheduleUnavailable')
                    : '',
                )
              }}
              step={900}
              type="datetime-local"
              value={newDate}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || !newDate}
                onClick={() => {
                  const value = dateInputRef.current?.value ?? newDate
                  if (value < localNowValue(current.timezone)) {
                    setError(t('public.rescheduleUnavailable'))
                    setSuccess('')
                    return
                  }
                  void reschedule()
                }}
                onPress={() => {
                  const value = dateInputRef.current?.value ?? newDate
                  if (value < localNowValue(current.timezone)) {
                    setError(t('public.rescheduleUnavailable'))
                    setSuccess('')
                    return
                  }
                  void reschedule()
                }}
              >
                {busy ? t('public.waitlist.busy') : t('public.saveChange')}
              </Button>
              {confirmingCancel ? (
                <div className="flex flex-wrap items-center gap-2">
                  <output aria-live="polite" className="text-destructive text-xs">
                    {t('public.cancelConfirm')}
                  </output>
                  <Button disabled={busy} onClick={() => void cancel()} variant="destructive">
                    Confirmar cancelación
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => setConfirmingCancel(false)}
                    variant="outline"
                  >
                    Seguir editando
                  </Button>
                </div>
              ) : (
                <Button
                  disabled={busy}
                  onClick={() => setConfirmingCancel(true)}
                  onPress={() => setConfirmingCancel(true)}
                  variant="outline"
                >
                  {t('public.cancelReservation')}
                </Button>
              )}
            </div>
          </div>
        )}
        {cancelled && (
          <p className="mt-6 text-xs leading-5 text-[#737983]">{t('public.tableReleased')}</p>
        )}
        <Link
          className="text-primary mt-6 inline-flex text-sm font-semibold underline underline-offset-4"
          to="/"
        >
          {t('public.backHome')}
        </Link>
      </section>
    </main>
  )
}
