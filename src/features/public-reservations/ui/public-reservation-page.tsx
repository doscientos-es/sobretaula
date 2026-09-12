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
  useFormFeedback,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Check, Clock3, MapPin, Users } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'

import { LanguageSwitcher } from '@/shared/lib/i18n/language-switcher'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { formatMessage, createTranslator } from '@/shared/lib/i18n/messages'

import {
  createPublicReservation,
  getPublicReservationAvailability,
  type PublicReservationProfile,
} from '../application/public-reservations'
import { zonedLocalToIso } from '../domain/zoned-time'

function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
}

function nextDates(weekday: number, timeZone: string): string[] {
  const today = localDateKey(new Date(), timeZone)
  const localDate = new Date(`${today}T12:00:00.000Z`)
  const result: string[] = []
  for (let offset = 0; offset < 30 && result.length < 8; offset += 1) {
    const date = new Date(localDate)
    date.setUTCDate(localDate.getUTCDate() + offset)
    if (date.getUTCDay() === weekday) result.push(date.toISOString().slice(0, 10))
  }
  return result
}

function slotsForService(service: PublicReservationProfile['services'][number]): string[] {
  const [startHour = 0, startMinute = 0] = service.startsAtTime.slice(0, 5).split(':').map(Number)
  const [endHour = 0, endMinute = 0] = service.endsAtTime.slice(0, 5).split(':').map(Number)
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  const slots: string[] = []
  for (let minute = start; minute < end; minute += service.slotMinutes) {
    slots.push(
      `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
    )
  }
  return slots
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date(`${date}T12:00:00.000Z`))
}

function restaurantTime(value: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value))
}

export function PublicReservationPage({ profile }: { profile: PublicReservationProfile }) {
  const locale = useLocale()
  const t = createTranslator(locale)
  const message = (
    key: Parameters<typeof formatMessage>[1],
    values: Record<string, string | number> = {},
  ) => formatMessage(locale, key, values)
  const feedback = useFormFeedback()
  const [serviceId, setServiceId] = useState(profile.services[0]?.id ?? '')
  const [areaId, setAreaId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [guestName, setGuestName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(!profile.terms)
  const [confirmed, setConfirmed] = useState(false)
  const [managementToken, setManagementToken] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [alternativeSlots, setAlternativeSlots] = useState<string[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const availabilityRequestRef = useRef(0)
  const service = profile.services.find((candidate) => candidate.id === serviceId)
  const dates = useMemo(
    () => (service ? nextDates(service.weekday, profile.timezone) : []),
    [profile.timezone, service],
  )
  const slots = useMemo(() => (service ? slotsForService(service) : []), [service])

  function selectService(id: string) {
    availabilityRequestRef.current += 1
    setServiceId(id)
    setDate('')
    setTime('')
    setAlternativeSlots([])
    setAvailableSlots([])
    setAvailabilityLoading(false)
  }

  async function selectDate(value: string, size = partySize, selectedArea = areaId) {
    const requestId = availabilityRequestRef.current + 1
    availabilityRequestRef.current = requestId
    setDate(value)
    setTime('')
    setAlternativeSlots([])
    if (!value || !service) {
      setAvailableSlots([])
      return
    }
    setAvailabilityLoading(true)
    try {
      const result = await getPublicReservationAvailability({
        data: {
          ...(selectedArea ? { areaId: selectedArea } : {}),
          date: value,
          partySize: size,
          serviceId: service.id,
          slug: profile.slug,
        },
      })
      if (requestId !== availabilityRequestRef.current) return
      const normalized = result.map((slot) =>
        slot.includes('T') ? restaurantTime(slot, profile.timezone, locale) : slot.slice(0, 5),
      )
      setAvailableSlots(normalized)
      if (selectedArea && result.length === 0) {
        const fallback = await getPublicReservationAvailability({
          data: { date: value, partySize: size, serviceId: service.id, slug: profile.slug },
        })
        if (requestId !== availabilityRequestRef.current) return
        setAlternativeSlots(
          fallback
            .slice(0, 3)
            .map((slot) =>
              slot.includes('T')
                ? restaurantTime(slot, profile.timezone, locale)
                : slot.slice(0, 5),
            ),
        )
      }
    } catch {
      if (requestId === availabilityRequestRef.current) setAvailableSlots([])
    } finally {
      if (requestId === availabilityRequestRef.current) setAvailabilityLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!service || !date || !time) {
      feedback.setError(t('public.chooseTime'))
      return
    }
    if (!privacyAccepted) {
      feedback.setError(t('public.acceptPrivacy'))
      return
    }
    if (profile.terms && !termsAccepted) {
      feedback.setError(t('public.acceptTermsError'))
      return
    }
    feedback.setPending()
    try {
      const result = await createPublicReservation({
        data: {
          email,
          ...(phone ? { phone } : {}),
          ...(areaId ? { areaId } : {}),
          guestName,
          ...(notes ? { notes } : {}),
          partySize,
          privacyAccepted: true,
          ...(profile.terms ? { termsVersionId: profile.terms.id } : {}),
          serviceId,
          slug: profile.slug,
          // The browser's local zone is the restaurant's zone in this MVP. The
          // server validates the instant again against the tenant timezone.
          startsAt: zonedLocalToIso(`${date}T${time}`, profile.timezone),
        },
      })
      setManagementToken(result.managementToken)
      setConfirmed(true)
      feedback.setSuccess('')
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? t('public.slotTaken')
          : t('public.bookingFailed'),
      )
    }
  }

  if (confirmed) {
    return (
      <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-[clamp(1rem,4vw,3.5rem)]">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>
        <section
          aria-labelledby="booking-confirmed"
          className="relative z-10 w-full max-w-[34rem] rounded-3xl border border-[#292d34]/10 bg-white/92 p-[clamp(2rem,7vw,5rem)] text-center shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)]"
        >
          <span
            aria-hidden="true"
            className="inline-grid size-16 place-items-center rounded-full bg-[#21835b] text-white"
          >
            <Check className="size-7" />
          </span>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#c34d3e] uppercase">
            {t('public.received')}
          </p>
          <h1
            id="booking-confirmed"
            className="mt-4 text-[clamp(2.25rem,6vw,4rem)] leading-[0.95] font-[650] tracking-[-0.075em] text-[#292d34]"
          >
            {message('public.weWait', { name: profile.name })}
          </h1>
          <p className="mt-6 leading-relaxed text-[#60656d]">
            {message(partySize === 1 ? 'public.confirmed.single' : 'public.confirmed.multiple', {
              count: partySize,
              date: formatDate(date, locale),
              time,
            })}
          </p>
          <Link
            className="st-public-booking-manage-link"
            params={{ token: managementToken }}
            to="/reserva/$token"
          >
            {t('public.manage')}
          </Link>
          <p className="mt-6 text-xs leading-5 text-[#737983]">
            {message('public.confirmationSent', { venue: profile.venueName })}
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-[clamp(1rem,4vw,3.5rem)]">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-72 -right-32 size-[32rem] rounded-full bg-[#f8c4a6] opacity-45 blur-xl motion-reduce:blur-none"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-88 -left-48 size-[32rem] rounded-full bg-[#d6e8d6] opacity-45 blur-xl motion-reduce:blur-none"
      />
      <section className="relative z-10 grid w-full max-w-[68rem] items-center gap-[clamp(1.5rem,5vw,5rem)] min-[800px]:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]">
        <header className="max-w-lg">
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#c34d3e] uppercase">
            {t('public.directBooking')}
          </p>
          <h1 className="m-0 text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95] font-[650] tracking-[-0.075em] text-[#292d34]">
            {profile.name}
          </h1>
          <p className="mt-5 max-w-sm text-[clamp(1.05rem,2vw,1.3rem)] leading-6 text-[#60656d]">
            {t('public.heroDescription')}
          </p>
          <div className="mt-8 grid gap-2.5 text-sm text-[#737983]">
            <span className="inline-flex items-center gap-2">
              <MapPin aria-hidden="true" className="size-4" /> {profile.venueName}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 aria-hidden="true" className="size-4" /> {t('public.bookingInMinute')}
            </span>
          </div>
        </header>
        <Card className="w-full max-w-lg border-[#292d34]/10 bg-white/92 shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)] backdrop-blur-[12px]">
          <CardHeader>
            <CardTitle>{t('public.findTable')}</CardTitle>
            <CardDescription>
              {profile.services.length > 0 ? t('public.noAccount') : t('public.noServices')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
              <Field>
                <FieldLabel htmlFor="public-service">{t('public.moment')}</FieldLabel>
                <select
                  id="public-service"
                  className="min-h-12 bg-white"
                  onChange={(event) => selectService(event.target.value)}
                  value={serviceId}
                >
                  {profile.services.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ·{' '}
                      {new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' }).format(
                        new Date(Date.UTC(2024, 0, 7 + candidate.weekday)),
                      )}
                    </option>
                  ))}
                </select>
              </Field>
              {profile.areas.length ? (
                <Field>
                  <FieldLabel htmlFor="public-area">{t('public.optionalArea')}</FieldLabel>
                  <select
                    id="public-area"
                    className="min-h-12 bg-white"
                    onChange={(event) => {
                      setAreaId(event.target.value)
                      if (date) void selectDate(date, partySize, event.target.value)
                    }}
                    value={areaId}
                  >
                    <option value="">{t('public.anyArea')}</option>
                    {profile.areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="public-date">
                    <CalendarDays aria-hidden="true" className="mr-1 inline size-4" />{' '}
                    {t('public.day')}
                  </FieldLabel>
                  <select
                    id="public-date"
                    className="min-h-12 bg-white"
                    onChange={(event) => void selectDate(event.target.value)}
                    required
                    value={date}
                  >
                    <option value="">{t('public.selectDay')}</option>
                    {dates.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {formatDate(candidate, locale)}
                      </option>
                    ))}
                  </select>
                  {date && !availabilityLoading && availableSlots.length === 0 ? (
                    <p className="mt-2 text-xs text-[#c34d3e]">
                      {areaId ? t('public.noSlotsInArea') : t('public.noSlots')}
                    </p>
                  ) : null}
                  {alternativeSlots.length ? (
                    <p className="mt-2 text-xs text-[#5b6470]">
                      {t('public.alternativeSlots')}{' '}
                      {alternativeSlots.map((slot) => (
                        <button
                          className="ml-2 underline"
                          key={slot}
                          onClick={() => {
                            setAreaId('')
                            setAvailableSlots([slot])
                            setTime(slot)
                          }}
                          type="button"
                        >
                          {slot}
                        </button>
                      ))}
                    </p>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="public-time">{t('public.time')}</FieldLabel>
                  <select
                    id="public-time"
                    className="min-h-12 bg-white"
                    onChange={(event) => setTime(event.target.value)}
                    required
                    value={time}
                  >
                    <option value="">{t('public.selectTime')}</option>
                    {(date ? availableSlots : slots).map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                  {availabilityLoading ? (
                    <p aria-live="polite" className="text-muted-foreground mt-2 text-xs">
                      {t('public.searching')}
                    </p>
                  ) : null}
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="public-party">
                  <Users aria-hidden="true" className="mr-1 inline size-4" /> {t('public.people')}
                </FieldLabel>
                <Input
                  id="public-party"
                  className="min-h-12"
                  max={50}
                  min={1}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value)
                    setPartySize(nextSize)
                    if (date) void selectDate(date, nextSize)
                  }}
                  required
                  type="number"
                  value={partySize}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="public-name">{t('public.name')}</FieldLabel>
                  <Input
                    autoComplete="name"
                    id="public-name"
                    onChange={(event) => setGuestName(event.target.value)}
                    required
                    value={guestName}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="public-phone">{t('public.phone')}</FieldLabel>
                  <Input
                    autoComplete="tel"
                    id="public-phone"
                    inputMode="tel"
                    onChange={(event) => setPhone(event.target.value)}
                    value={phone}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="public-email">{t('public.email')}</FieldLabel>
                <Input
                  autoComplete="email"
                  id="public-email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="public-notes">{t('public.notes')}</FieldLabel>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-white px-3 py-2"
                  id="public-notes"
                  maxLength={1000}
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </Field>
              <label className="flex items-start gap-2 text-xs leading-5 text-[#737983]">
                <input
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>{t('public.privacyConsent')}</span>
              </label>
              {profile.terms ? (
                <div className="grid gap-2 rounded-md border border-[#292d34]/10 bg-[#fbfaf8] p-3 text-xs leading-5 text-[#60656d]">
                  <p className="font-semibold text-[#292d34]">
                    {profile.terms.title} ·{' '}
                    {message('public.termsVersion', { version: profile.terms.version })}
                  </p>
                  <p className="max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {profile.terms.body}
                  </p>
                  <label className="flex items-start gap-2">
                    <input
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      required
                      type="checkbox"
                    />
                    <span>{t('public.acceptTerms')}</span>
                  </label>
                </div>
              ) : null}
              <FormFeedback pendingLabel={t('public.checking')} state={feedback.state} />
              <Button
                className="w-full"
                disabled={
                  feedback.pending ||
                  availabilityLoading ||
                  profile.services.length === 0 ||
                  Boolean(date && availableSlots.length === 0)
                }
                size="lg"
                type="submit"
              >
                {t('public.reserve')}
              </Button>
              <p className="m-0 text-xs leading-5 text-[#737983]">
                {message('public.legalPrefix', { name: profile.name })}{' '}
                <Link
                  className="underline underline-offset-2"
                  params={{ slug: profile.slug }}
                  rel="noreferrer"
                  target="_blank"
                  to="/reservar/$slug/privacidad"
                >
                  {t('public.privacyPolicy')}
                </Link>{' '}
                {t('public.andTerms')}{' '}
                <Link
                  className="underline underline-offset-2"
                  params={{ slug: profile.slug }}
                  rel="noreferrer"
                  target="_blank"
                  to="/reservar/$slug/condiciones"
                >
                  {t('public.bookingTerms')}
                </Link>
                .
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
