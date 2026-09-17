import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  useFormFeedback,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Check, MapPin, Minus, Plus, Users } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'

import { LanguageSwitcher } from '@/shared/lib/i18n/language-switcher'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { formatMessage, createTranslator } from '@/shared/lib/i18n/messages'

import { publicReservationFailure } from '../application/public-reservation-error'
import {
  createPublicReservation,
  getPublicReservationAvailability,
  publicReservationInput,
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

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date(`${date}T12:00:00.000Z`))
}

function formatDateOption(date: string, locale: string) {
  const value = new Date(`${date}T12:00:00.000Z`)
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(value)
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(value)
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(value)
  return { day, month, weekday }
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
  const [serviceId, setServiceId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [adultCount, setAdultCount] = useState(2)
  const [childCount, setChildCount] = useState(0)
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
  const [availabilityError, setAvailabilityError] = useState(false)
  const availabilityRequestRef = useRef(0)
  const service = profile.services.find((candidate) => candidate.id === serviceId)
  const dates = useMemo(
    () => (service ? nextDates(service.weekday, profile.timezone) : []),
    [profile.timezone, service],
  )

  function selectService(id: string) {
    availabilityRequestRef.current += 1
    setServiceId(id)
    setDate('')
    setTime('')
    setAlternativeSlots([])
    setAvailableSlots([])
    setAvailabilityError(false)
    setAvailabilityLoading(false)
  }

  async function selectDate(value: string, size = partySize, selectedArea = areaId) {
    const requestId = availabilityRequestRef.current + 1
    availabilityRequestRef.current = requestId
    setDate(value)
    setTime('')
    setAlternativeSlots([])
    setAvailabilityError(false)
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
      if (requestId === availabilityRequestRef.current) {
        setAvailableSlots([])
        setAvailabilityError(true)
      }
    } finally {
      if (requestId === availabilityRequestRef.current) setAvailabilityLoading(false)
    }
  }

  function updateGuests(adults: number, children: number) {
    const nextSize = adults + children
    setAdultCount(adults)
    setChildCount(children)
    setPartySize(nextSize)
    if (date) void selectDate(date, nextSize)
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
    const data = {
      email,
      ...(phone ? { phone } : {}),
      ...(areaId ? { areaId } : {}),
      guestName,
      ...(notes ? { notes } : {}),
      partySize,
      privacyAccepted: true as const,
      ...(profile.terms ? { termsVersionId: profile.terms.id } : {}),
      serviceId,
      slug: profile.slug,
      startsAt: zonedLocalToIso(`${date}T${time}`, profile.timezone),
    }
    const parsed = publicReservationInput.safeParse(data)
    if (!parsed.success) {
      feedback.setError(t('public.bookingDetailsInvalid'))
      return
    }
    feedback.setPending()
    try {
      const result = await createPublicReservation({
        data: parsed.data,
      })
      setManagementToken(result.managementToken)
      setConfirmed(true)
      feedback.setSuccess('')
    } catch (error) {
      const failure = publicReservationFailure(error)
      feedback.setError(
        failure === 'slotTaken'
          ? t('public.slotTaken')
          : failure === 'rateLimited'
            ? t('public.rateLimited')
            : failure === 'termsUnavailable'
              ? t('public.termsUnavailable')
              : failure === 'selectionUnavailable'
                ? t('public.selectionUnavailable')
                : failure === 'detailsInvalid'
                  ? t('public.bookingDetailsInvalid')
                  : t('public.bookingFailed'),
      )
    }
  }

  const theme = {
    '--public-primary': profile.primaryColor,
    '--public-accent': profile.accentColor,
  } as React.CSSProperties
  if (confirmed) {
    return (
      <main
        style={theme}
        className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-[clamp(1rem,4vw,3.5rem)]"
      >
        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>
        <section
          aria-labelledby="booking-confirmed"
          className="relative z-10 w-full max-w-[34rem] rounded-3xl border border-[#292d34]/10 bg-white/92 p-[clamp(2rem,7vw,5rem)] text-center shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)]"
        >
          <span
            aria-hidden="true"
            className="inline-grid size-16 place-items-center rounded-full bg-[var(--public-primary)] text-white"
          >
            <Check className="size-7" />
          </span>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[var(--public-accent)] uppercase">
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
    <main
      style={theme}
      className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-[clamp(1rem,4vw,3.5rem)]"
    >
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[url('/abstract-restaurant-image.avif')] bg-cover bg-center opacity-60"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white/60" />
      <section className="relative z-10 w-full max-w-[34rem]">
        <Card className="w-full border-[#292d34]/10 bg-[#f7f7f7]/95 shadow-[0_1.5rem_4rem_rgb(66_48_35_/_22%)] backdrop-blur-[12px]">
          <CardHeader className="items-center pb-3 text-center">
            {profile.logoUrl ? (
              <img
                alt={`Logo de ${profile.name}`}
                className="mb-1 h-10 max-w-40 object-contain"
                src={profile.logoUrl}
              />
            ) : null}
            <CardTitle className="text-2xl tracking-[-0.04em]">
              {message('public.reserveAt', { name: profile.name })}
            </CardTitle>
            <p className="m-0 flex items-center gap-1.5 text-sm text-[#60656d]">
              <MapPin aria-hidden="true" className="size-3.5" /> {profile.venueName}
            </p>
          </CardHeader>
          <CardContent>
            {profile.services.length === 0 ? (
              <output
                aria-live="polite"
                className="rounded-lg border border-dashed border-[#c34d3e]/40 bg-[#fff7f4] p-4 text-sm text-[#60656d]"
              >
                <span className="block font-medium text-[#292d34]">{t('public.noServices')}</span>
                <span className="mt-1 block">{t('public.noServicesAction')}</span>
              </output>
            ) : (
              <form
                aria-busy={availabilityLoading || feedback.pending}
                className="grid gap-5"
                noValidate
                onSubmit={(event) => void submit(event)}
              >
                <fieldset className="grid gap-2 border-0 p-0">
                  <legend className="text-center text-sm font-semibold text-[#60656d]">
                    {t('public.moment')}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2" id="public-service">
                    {profile.services.map((candidate) => (
                      <button
                        aria-pressed={serviceId === candidate.id}
                        className={`rounded-md border px-4 py-3 text-sm font-semibold transition ${
                          serviceId === candidate.id
                            ? 'border-[var(--public-primary)] bg-[var(--public-primary)] text-white shadow-sm'
                            : 'border-[#d6d7d8] bg-white text-[#292d34] hover:border-[var(--public-primary)]'
                        }`}
                        key={candidate.id}
                        onClick={() => selectService(candidate.id)}
                        type="button"
                      >
                        {candidate.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="grid gap-2 border-0 p-0">
                  <legend className="text-center text-sm font-semibold text-[#60656d]">
                    {t('public.people')}
                  </legend>
                  <div className="grid gap-2 rounded-xl border border-[#292d34]/10 bg-white p-2">
                    {[
                      { label: t('public.adults'), value: adultCount },
                      { label: t('public.children'), value: childCount },
                    ].map(({ label, value }, index) => {
                      const adults = index === 0
                      const decrementDisabled = adults ? adultCount <= 1 : childCount <= 0
                      const incrementDisabled = partySize >= 50
                      return (
                        <div
                          className="flex items-center justify-between gap-4 px-2 py-1"
                          key={label}
                        >
                          <span className="inline-flex items-center gap-2 text-sm text-[#292d34]">
                            <Users aria-hidden="true" className="size-4 text-[#737983]" />
                            {label}
                          </span>
                          <div className="flex items-center overflow-hidden rounded-md border border-[#cfd0d2]">
                            <button
                              aria-label={`${label} -`}
                              className="st-compact-control grid size-9 place-items-center bg-[#f3f3f3] text-[#292d34] transition hover:bg-[#e8e8e9] disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={decrementDisabled || feedback.pending}
                              onClick={() =>
                                updateGuests(
                                  adults ? adultCount - 1 : adultCount,
                                  adults ? childCount : childCount - 1,
                                )
                              }
                              type="button"
                            >
                              <Minus aria-hidden="true" className="size-4" />
                            </button>
                            <output
                              aria-live="polite"
                              className="grid min-w-12 place-items-center px-2 text-sm font-semibold"
                            >
                              {value}
                            </output>
                            <button
                              aria-label={`${label} +`}
                              className="st-compact-control grid size-9 place-items-center bg-[#f3f3f3] text-[#292d34] transition hover:bg-[#e8e8e9] disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={incrementDisabled || feedback.pending}
                              onClick={() =>
                                updateGuests(
                                  adults ? adultCount + 1 : adultCount,
                                  adults ? childCount : childCount + 1,
                                )
                              }
                              type="button"
                            >
                              <Plus aria-hidden="true" className="size-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </fieldset>
                {profile.areas.length ? (
                  <Field>
                    <FieldLabel htmlFor="public-area">{t('public.optionalArea')}</FieldLabel>
                    <select
                      id="public-area"
                      className="min-h-12 bg-white"
                      name="areaId"
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
                <fieldset className="grid gap-2 border-0 p-0">
                  <legend className="flex items-center gap-1.5 text-sm font-semibold text-[#60656d]">
                    <CalendarDays aria-hidden="true" className="size-4" /> {t('public.day')}
                  </legend>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" id="public-date">
                    {dates.slice(0, 6).map((candidate) => {
                      const option = formatDateOption(candidate, locale)
                      const isToday = candidate === localDateKey(new Date(), profile.timezone)
                      return (
                        <button
                          aria-pressed={date === candidate}
                          className={`grid min-h-16 place-items-center rounded-md border px-1 py-2 text-center transition ${
                            date === candidate
                              ? 'border-[var(--public-primary)] bg-[var(--public-primary)] text-white shadow-sm'
                              : 'border-[#d6d7d8] bg-white text-[#60656d] hover:border-[var(--public-primary)]'
                          }`}
                          key={candidate}
                          onClick={() => void selectDate(candidate)}
                          type="button"
                        >
                          <span className="text-[0.62rem] font-bold uppercase">
                            {isToday ? t('public.today') : option.weekday}
                          </span>
                          <strong className="text-lg leading-5">{option.day}</strong>
                          <span className="text-[0.62rem] uppercase">{option.month}</span>
                        </button>
                      )
                    })}
                  </div>
                  {!service ? (
                    <p className="m-0 text-xs text-[#737983]">{t('public.selectMoment')}</p>
                  ) : null}
                </fieldset>
                <fieldset className="grid gap-2 border-0 p-0">
                  <legend className="text-sm font-semibold text-[#60656d]">
                    {t('public.time')}
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" id="public-time">
                    {availableSlots.map((candidate) => (
                      <button
                        aria-pressed={time === candidate}
                        className={`rounded-md border px-3 py-2.5 text-sm font-semibold transition ${
                          time === candidate
                            ? 'border-[var(--public-primary)] bg-[var(--public-primary)] text-white shadow-sm'
                            : 'border-[#d6d7d8] bg-white text-[#292d34] hover:border-[var(--public-primary)]'
                        }`}
                        key={candidate}
                        onClick={() => setTime(candidate)}
                        type="button"
                      >
                        {candidate}
                      </button>
                    ))}
                  </div>
                  <div aria-live="polite" className="text-xs" id="public-availability-status">
                    {availabilityLoading ? (
                      <p className="text-muted-foreground flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-2 animate-pulse rounded-full bg-[var(--public-accent)] motion-reduce:animate-none"
                        />
                        {t('public.searching')}
                      </p>
                    ) : availabilityError ? (
                      <div className="flex flex-wrap items-center gap-2 text-[var(--public-accent)]">
                        <span>{t('public.availabilityFailed')}</span>
                        <button
                          className="font-semibold underline underline-offset-2"
                          onClick={() => void selectDate(date)}
                          type="button"
                        >
                          {t('error.retry')}
                        </button>
                      </div>
                    ) : date && availableSlots.length === 0 ? (
                      <p className="text-[var(--public-accent)]">
                        {areaId ? t('public.noSlotsInArea') : t('public.noSlots')}
                      </p>
                    ) : alternativeSlots.length ? (
                      <p className="text-[#5b6470]">
                        {t('public.alternativeSlots')}{' '}
                        {alternativeSlots.map((slot) => (
                          <button
                            className="ml-2 font-semibold underline underline-offset-2"
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
                  </div>
                </fieldset>
                <fieldset className="grid gap-4 border-0 border-t border-[#292d34]/10 pt-4">
                  <legend className="mb-1 text-sm font-semibold text-[#60656d]">
                    {t('public.guestDetails')}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="public-name">{t('public.name')}</FieldLabel>
                      <Input
                        autoComplete="name"
                        id="public-name"
                        name="guestName"
                        maxLength={200}
                        minLength={2}
                        onChange={(event) => setGuestName(event.target.value)}
                        placeholder="Ej. Ana García"
                        required
                        value={guestName}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="public-phone">{t('public.phone')}</FieldLabel>
                      <Input
                        autoComplete="tel"
                        id="public-phone"
                        name="phone"
                        inputMode="tel"
                        maxLength={40}
                        minLength={6}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="Ej. 600 123 456"
                        value={phone}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="public-email">{t('public.email')}</FieldLabel>
                    <Input
                      autoComplete="email"
                      id="public-email"
                      name="email"
                      maxLength={200}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ana@ejemplo.com"
                      required
                      type="email"
                      value={email}
                    />
                  </Field>
                </fieldset>
                <Field>
                  <FieldLabel htmlFor="public-notes">{t('public.notes')}</FieldLabel>
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-white px-3 py-2"
                    id="public-notes"
                    name="notes"
                    maxLength={1000}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Alergias, carrito de bebé, ocasión especial…"
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
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
