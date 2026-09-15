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
  cn,
  useFormFeedback,
} from '@doscientos/ui'
import { Building2, CircleCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { isValidSpanishTaxId, normalizeSpanishTaxId } from '@/shared/lib/fiscal/spanish-tax-id'
import { SUPPORTED_LOCALES, type Locale } from '@/shared/lib/i18n/locale'
import { useLocale, useLocalePreference } from '@/shared/lib/i18n/locale-preference'
import { createTranslator, formatMessage } from '@/shared/lib/i18n/messages'
import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import { getTenantBySlug } from '../application/get-tenant-by-slug'
import { tenantOnboardingErrorMessage } from '../application/onboarding-error'
import { tenantSlugCandidate } from '../application/onboarding-schema'
import { provisionTenantOnboarding } from '../application/provision-tenant-onboarding'
import { TENANT_ONBOARDING_STAGES, tenantOnboardingStageStatus } from './tenant-onboarding-progress'

type OnboardingField =
  | 'addressLine'
  | 'city'
  | 'email'
  | 'legalName'
  | 'name'
  | 'postalCode'
  | 'slug'
  | 'taxId'

const ONBOARDING_FIELD_IDS: Record<OnboardingField, string> = {
  addressLine: 'address',
  city: 'city',
  email: 'billing-email',
  legalName: 'legal-name',
  name: 'tenant-name',
  postalCode: 'postal-code',
  slug: 'tenant-slug',
  taxId: 'tax-id',
}

const ONBOARDING_FIELDS = Object.keys(ONBOARDING_FIELD_IDS) as OnboardingField[]

function OnboardingFieldError({
  error,
  field,
}: {
  error: string | undefined
  field: OnboardingField
}) {
  if (!error) return null
  return (
    <p className="text-destructive text-sm text-pretty" id={`${ONBOARDING_FIELD_IDS[field]}-error`}>
      {error}
    </p>
  )
}

export function TenantOnboardingPage() {
  const interfaceLocale = useLocale('es')
  const { setLocale } = useLocalePreference()
  const t = createTranslator(interfaceLocale)
  const message = (
    key: Parameters<typeof formatMessage>[1],
    values: Record<string, string | number>,
  ) => formatMessage(interfaceLocale, key, values)
  const feedback = useFormFeedback()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedLocale, setSelectedLocale] = useState<Locale | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [legalName, setLegalName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [email, setEmail] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [createdTenant, setCreatedTenant] = useState<{ slug: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<OnboardingField, string>>>({})
  const defaultLocale = selectedLocale ?? interfaceLocale
  const stageStatuses = tenantOnboardingStageStatus(step, Boolean(createdTenant))
  const header = createdTenant
    ? {
        description: t('onboarding.header.ready.description'),
        title: t('onboarding.header.ready.title'),
      }
    : step === 1
      ? {
          description: t('onboarding.header.restaurant.description'),
          title: t('onboarding.header.restaurant.title'),
        }
      : step === 2
        ? {
            description: t('onboarding.header.billing.description'),
            title: t('onboarding.header.billing.title'),
          }
        : {
            description: t('onboarding.header.review.description'),
            title: t('onboarding.header.review.title'),
          }
  const draft = {
    name,
    slug,
    legalName,
    taxId,
    email,
    addressLine,
    city,
    postalCode,
    locale: defaultLocale,
  }

  useAsyncEffect(() => {
    const saved = window.localStorage.getItem('sobretaula:onboarding-draft')
    if (!saved) return
    try {
      const value = JSON.parse(saved) as Partial<typeof draft>
      if (value.name) setName(value.name)
      if (value.slug) setSlug(value.slug)
      if (value.legalName) setLegalName(value.legalName)
      if (value.taxId) setTaxId(value.taxId)
      if (value.email) setEmail(value.email)
      if (value.addressLine) setAddressLine(value.addressLine)
      if (value.city) setCity(value.city)
      if (value.postalCode) setPostalCode(value.postalCode)
      if (value.locale && SUPPORTED_LOCALES.includes(value.locale as Locale))
        setSelectedLocale(value.locale as Locale)
    } catch {
      window.localStorage.removeItem('sobretaula:onboarding-draft')
    }
    // The draft is intentionally restored once when the form mounts.
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      'sobretaula:onboarding-draft',
      JSON.stringify({
        name,
        slug,
        legalName,
        taxId,
        email,
        addressLine,
        city,
        postalCode,
        locale: defaultLocale,
      }),
    )
  }, [name, slug, legalName, taxId, email, addressLine, city, postalCode, defaultLocale])

  function changeName(value: string) {
    setName(value)
    clearFieldError('name')
    if (!slugEdited) {
      setSlug(tenantSlugCandidate(value))
      clearFieldError('slug')
    }
  }

  function clearFieldError(field: OnboardingField) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const { [field]: _removed, ...remaining } = current
      return remaining
    })
  }

  function focusField(field: OnboardingField) {
    window.requestAnimationFrame(() =>
      document.getElementById(ONBOARDING_FIELD_IDS[field])?.focus(),
    )
  }

  function validateStep(): Partial<Record<OnboardingField, string>> {
    const errors: Partial<Record<OnboardingField, string>> = {}
    if (step === 1) {
      if (!name.trim()) errors.name = t('onboarding.validation.nameRequired')
      if (!slug.trim()) errors.slug = t('onboarding.validation.slugRequired')
      else if (!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug))
        errors.slug = t('onboarding.validation.slugInvalid')
      return errors
    }

    if (!legalName.trim()) errors.legalName = t('onboarding.validation.legalNameRequired')
    if (!taxId.trim()) errors.taxId = t('onboarding.validation.taxIdRequired')
    else if (!isValidSpanishTaxId(taxId)) errors.taxId = t('onboarding.validation.taxIdInvalid')
    if (!email.trim()) errors.email = t('onboarding.validation.billingEmailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = t('onboarding.validation.billingEmailInvalid')
    if (!addressLine.trim()) errors.addressLine = t('onboarding.validation.addressRequired')
    if (!city.trim()) errors.city = t('onboarding.validation.cityRequired')
    if (!postalCode.trim()) errors.postalCode = t('onboarding.validation.postalCodeRequired')
    else if (!/^\d{5}$/.test(postalCode.trim()))
      errors.postalCode = t('onboarding.validation.postalCodeInvalid')
    return errors
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < 3) {
      if (feedback.pending) return
      const errors = validateStep()
      const firstInvalidField = ONBOARDING_FIELDS.find((field) => errors[field])
      if (firstInvalidField) {
        setFieldErrors(errors)
        feedback.setError(t('onboarding.validation.reviewFields'))
        focusField(firstInvalidField)
        return
      }
      setFieldErrors({})
      if (step === 1) {
        feedback.setPending()
        try {
          const existingTenant = await getTenantBySlug({ data: { slug: slug.trim() } })
          if (existingTenant) {
            feedback.setError(t('onboarding.validation.slugTaken'))
            return
          }
        } catch {
          feedback.setError(t('onboarding.validation.slugCheckFailed'))
          return
        }
      }
      feedback.reset()
      setStep((current) => (current + 1) as 1 | 2 | 3)
      return
    }
    if (feedback.pending) return
    feedback.setPending()
    try {
      const tenant = await provisionTenantOnboarding({
        data: {
          addressLine,
          city,
          defaultLocale,
          email,
          legalName,
          name,
          postalCode,
          slug,
          taxId,
          timezone: 'Europe/Madrid',
        },
      })
      setLocale(defaultLocale)
      window.localStorage.removeItem('sobretaula:onboarding-draft')
      setCreatedTenant(tenant)
    } catch (error) {
      if (error instanceof Response && error.status === 409) setStep(1)
      feedback.setError(tenantOnboardingErrorMessage(error))
    }
  }

  return (
    <main className="st-auth-shell st-auth-shell--orange py-10">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <section className="st-onboarding-content relative w-full max-w-3xl">
        <div className="mb-6 max-w-xl">
          <h1 className="text-foreground mt-2 text-4xl tracking-[-0.05em]">
            {t('onboarding.intro.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {t('onboarding.intro.description')}
          </p>
        </div>
        <p aria-live="polite" className="sr-only">
          {createdTenant
            ? t('onboarding.progress.created')
            : message('onboarding.progress.current', { step, title: header.title })}
        </p>
        <ol className="mb-4 grid grid-cols-3 gap-2" aria-label={t('onboarding.progress.label')}>
          {TENANT_ONBOARDING_STAGES.map((stage, index) => {
            const status = stageStatuses[index]
            return (
              <li
                aria-current={status === 'active' ? 'step' : undefined}
                className={cn(
                  'rounded-xl border p-3',
                  status === 'active' && 'border-primary/50 bg-background shadow-sm',
                  status === 'done' && 'border-success/40 bg-background/70',
                  status === 'upcoming' && 'bg-background/70',
                )}
                key={stage}
              >
                <div
                  className={cn(
                    'mb-1 text-xs font-semibold',
                    status === 'active' && 'text-primary',
                    status === 'done' && 'text-success',
                    status === 'upcoming' && 'text-muted-foreground',
                  )}
                >
                  0{index + 1}
                </div>
                <div className="text-sm font-medium">{t(stage)}</div>
                <span className="sr-only">
                  {status === 'done'
                    ? t('onboarding.progress.done')
                    : status === 'active'
                      ? t('onboarding.progress.currentStep')
                      : t('onboarding.progress.pending')}
                </span>
                <div aria-hidden="true" className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      'h-full transition-[width] duration-200',
                      status === 'active' && 'bg-primary w-1/2',
                      status === 'done' && 'bg-success w-full',
                      status === 'upcoming' && 'w-0',
                    )}
                  />
                </div>
              </li>
            )
          })}
        </ol>
        <Card className="st-auth-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="st-brand-mark">
                <Building2 className="size-5" />
              </span>
              <span className="text-success inline-flex items-center gap-1.5 text-sm font-medium">
                <CircleCheck className="size-4" /> {t('onboarding.protectedData')}
              </span>
            </div>
            <CardTitle>{header.title}</CardTitle>
            <CardDescription>{header.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {createdTenant ? (
              <div className="space-y-5">
                <p className="text-sm leading-6">{t('onboarding.ready.description')}</p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    // The tenant is still setup_pending here. The billing route is protected by
                    // the operational-tenant middleware, while the tenant home renders the
                    // activation checklist and its payment authorization action.
                    onPress={() => window.location.assign(`/t/${createdTenant.slug}`)}
                    size="lg"
                  >
                    {t('onboarding.ready.action')}
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-5" noValidate onSubmit={(event) => void submit(event)}>
                {step === 1 ? (
                  <>
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold">
                        {t('onboarding.restaurant.stepTitle')}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {t('onboarding.restaurant.slugHelp')}
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="tenant-name">{t('onboarding.field.name')}</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.name ? 'tenant-name-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.name)}
                          id="tenant-name"
                          onChange={(event) => changeName(event.target.value)}
                          placeholder={t('onboarding.placeholder.businessName')}
                          required
                          value={name}
                        />
                        <OnboardingFieldError error={fieldErrors.name} field="name" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="tenant-slug">{t('onboarding.field.slug')}</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.slug ? 'tenant-slug-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.slug)}
                          id="tenant-slug"
                          onChange={(event) => {
                            setSlugEdited(true)
                            setSlug(event.target.value)
                            clearFieldError('slug')
                          }}
                          pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
                          placeholder={t('onboarding.placeholder.slug')}
                          required
                          value={slug}
                        />
                        <OnboardingFieldError error={fieldErrors.slug} field="slug" />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="tenant-locale">
                        {t('onboarding.language.label')}
                      </FieldLabel>
                      <select
                        className="border-input bg-background min-h-10 w-full rounded-md border px-3 text-sm"
                        id="tenant-locale"
                        onChange={(event) => {
                          const nextLocale = event.target.value
                          if (SUPPORTED_LOCALES.includes(nextLocale as Locale))
                            setSelectedLocale(nextLocale as Locale)
                        }}
                        value={defaultLocale}
                      >
                        <option value="es">{t('onboarding.language.spanish')}</option>
                        <option value="ca">{t('onboarding.language.catalan')}</option>
                      </select>
                      <p className="text-muted-foreground text-xs leading-5">
                        {t('onboarding.language.description')}
                      </p>
                    </Field>
                  </>
                ) : null}
                {step === 2 ? (
                  <>
                    <div className="space-y-1 pt-1">
                      <h2 className="text-sm font-semibold">
                        {t('onboarding.header.billing.title')}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {t('onboarding.header.billing.description')}
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="legal-name">
                          {t('onboarding.field.legalName')}
                        </FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.legalName ? 'legal-name-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.legalName)}
                          autoComplete="organization"
                          id="legal-name"
                          onChange={(event) => {
                            setLegalName(event.target.value)
                            clearFieldError('legalName')
                          }}
                          placeholder={t('onboarding.placeholder.legalName')}
                          required
                          value={legalName}
                        />
                        <OnboardingFieldError error={fieldErrors.legalName} field="legalName" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="tax-id">{t('onboarding.field.taxId')}</FieldLabel>
                        <Input
                          aria-describedby="tax-id-help"
                          aria-errormessage={fieldErrors.taxId ? 'tax-id-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.taxId)}
                          autoCapitalize="characters"
                          id="tax-id"
                          maxLength={32}
                          onBlur={() => setTaxId(normalizeSpanishTaxId(taxId))}
                          onChange={(event) => {
                            setTaxId(event.target.value)
                            clearFieldError('taxId')
                          }}
                          placeholder={t('onboarding.placeholder.taxId')}
                          required
                          spellCheck={false}
                          value={taxId}
                        />
                        <p className="text-muted-foreground text-xs text-pretty" id="tax-id-help">
                          {t('onboarding.taxIdHelp')}
                        </p>
                        <OnboardingFieldError error={fieldErrors.taxId} field="taxId" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="billing-email">
                          {t('onboarding.field.billingEmail')}
                        </FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.email ? 'billing-email-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.email)}
                          autoComplete="email"
                          id="billing-email"
                          onChange={(event) => {
                            setEmail(event.target.value)
                            clearFieldError('email')
                          }}
                          placeholder={t('onboarding.placeholder.billingEmail')}
                          required
                          type="email"
                          value={email}
                        />
                        <OnboardingFieldError error={fieldErrors.email} field="email" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="address">{t('onboarding.field.address')}</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.addressLine ? 'address-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.addressLine)}
                          autoComplete="address-line1"
                          id="address"
                          onChange={(event) => {
                            setAddressLine(event.target.value)
                            clearFieldError('addressLine')
                          }}
                          placeholder={t('onboarding.placeholder.address')}
                          required
                          value={addressLine}
                        />
                        <OnboardingFieldError error={fieldErrors.addressLine} field="addressLine" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="city">{t('onboarding.field.city')}</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.city ? 'city-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.city)}
                          autoComplete="address-level2"
                          id="city"
                          onChange={(event) => {
                            setCity(event.target.value)
                            clearFieldError('city')
                          }}
                          placeholder={t('onboarding.placeholder.city')}
                          required
                          value={city}
                        />
                        <OnboardingFieldError error={fieldErrors.city} field="city" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="postal-code">
                          {t('onboarding.field.postalCode')}
                        </FieldLabel>
                        <Input
                          aria-errormessage={
                            fieldErrors.postalCode ? 'postal-code-error' : undefined
                          }
                          aria-invalid={Boolean(fieldErrors.postalCode)}
                          autoComplete="postal-code"
                          id="postal-code"
                          inputMode="numeric"
                          maxLength={5}
                          onChange={(event) => {
                            setPostalCode(event.target.value)
                            clearFieldError('postalCode')
                          }}
                          placeholder={t('onboarding.placeholder.postalCode')}
                          required
                          value={postalCode}
                        />
                        <OnboardingFieldError error={fieldErrors.postalCode} field="postalCode" />
                      </Field>
                    </div>
                  </>
                ) : null}
                {step === 3 ? (
                  <div className="space-y-3">
                    <p className="text-muted-foreground mb-4 text-sm">
                      {t('onboarding.review.description')}
                    </p>
                    {[
                      [t('onboarding.review.restaurant'), name, slug],
                      [
                        t('onboarding.review.language'),
                        defaultLocale === 'ca'
                          ? t('onboarding.language.catalan')
                          : t('onboarding.language.spanish'),
                        'Europe/Madrid',
                      ],
                      [t('onboarding.review.billing'), legalName, `${taxId} · ${email}`],
                      [t('onboarding.review.address'), addressLine, `${postalCode} · ${city}`],
                    ].map(([label, primary, secondary]) => (
                      <div className="flex items-start gap-3 rounded-xl border p-4" key={label}>
                        <CircleCheck className="text-success mt-0.5 size-5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-xs font-semibold uppercase">
                            {label}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold">{primary}</p>
                          <p className="text-muted-foreground truncate text-sm">{secondary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <FormFeedback pendingLabel={t('onboarding.pending')} state={feedback.state} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    disabled={feedback.pending || step === 1}
                    onPress={() => setStep((current) => (current - 1) as 1 | 2 | 3)}
                    type="button"
                    variant="ghost"
                  >
                    {t('onboarding.back')}
                  </Button>
                  <Button disabled={feedback.pending} size="lg" type="submit">
                    {step === 3 ? t('onboarding.create') : t('onboarding.continue')}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
