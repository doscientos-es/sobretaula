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
import { createTranslator } from '@/shared/lib/i18n/messages'
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
    <p className="text-destructive text-sm" id={`${ONBOARDING_FIELD_IDS[field]}-error`}>
      {error}
    </p>
  )
}

export function TenantOnboardingPage() {
  const interfaceLocale = useLocale('es')
  const { setLocale } = useLocalePreference()
  const t = createTranslator(interfaceLocale)
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
        description:
          'Tu restaurante está listo. Autoriza el pago seguro para activar el acceso a la sala, las reservas y el equipo.',
        title: 'Activa tu restaurante',
      }
    : step === 1
      ? {
          description: 'Empieza por los datos básicos. No se realiza ningún cargo en este paso.',
          title: 'Configura tu restaurante',
        }
      : step === 2
        ? {
            description:
              'Necesitamos estos datos para preparar tu suscripción; el pago se autoriza después.',
            title: 'Datos de facturación',
          }
        : {
            description: 'Comprueba los datos antes de crear tu restaurante.',
            title: 'Revisa los datos del alta',
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
      if (!name.trim()) errors.name = 'Indica el nombre comercial del restaurante.'
      if (!slug.trim()) errors.slug = 'Indica el identificador para la URL del restaurante.'
      else if (!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug))
        errors.slug = 'Usa minúsculas, números y guiones; entre 3 y 50 caracteres.'
      return errors
    }

    if (!legalName.trim()) errors.legalName = 'Indica la razón social.'
    if (!taxId.trim()) errors.taxId = 'Indica el NIF, NIE o CIF.'
    else if (!isValidSpanishTaxId(taxId))
      errors.taxId = 'Revisa el formato y el carácter de control del NIF, NIE o CIF.'
    if (!email.trim()) errors.email = 'Indica el correo de facturación.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = 'Escribe un correo de facturación válido.'
    if (!addressLine.trim()) errors.addressLine = 'Indica la dirección fiscal.'
    if (!city.trim()) errors.city = 'Indica la ciudad.'
    if (!postalCode.trim()) errors.postalCode = 'Indica el código postal.'
    else if (!/^\d{5}$/.test(postalCode.trim()))
      errors.postalCode = 'El código postal debe tener cinco cifras.'
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
        feedback.setError('Revisa los campos marcados antes de continuar.')
        focusField(firstInvalidField)
        return
      }
      setFieldErrors({})
      if (step === 1) {
        feedback.setPending()
        try {
          const existingTenant = await getTenantBySlug({ data: { slug: slug.trim() } })
          if (existingTenant) {
            feedback.setError(
              'Ese identificador ya está en uso. Elige otro para la URL de tu restaurante.',
            )
            return
          }
        } catch {
          feedback.setError(
            'No se ha podido comprobar el identificador. Revisa tu conexión e inténtalo de nuevo.',
          )
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
            Vamos a preparar tu casa.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Completa los datos esenciales. Configurarás la sala y el equipo justo después.
          </p>
        </div>
        <p aria-live="polite" className="sr-only">
          {createdTenant
            ? 'Restaurante creado. Paso 3 de 3: activación.'
            : `Paso ${step} de 3: ${header.title}.`}
        </p>
        <ol className="mb-4 grid grid-cols-3 gap-2" aria-label="Progreso del alta">
          {TENANT_ONBOARDING_STAGES.map((label, index) => {
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
                key={label}
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
                <div className="text-sm font-medium">{label}</div>
                <span className="sr-only">
                  {status === 'done'
                    ? 'Completado'
                    : status === 'active'
                      ? 'Paso actual'
                      : 'Pendiente'}
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
                <CircleCheck className="size-4" /> Datos protegidos
              </span>
            </div>
            <CardTitle>{header.title}</CardTitle>
            <CardDescription>{header.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {createdTenant ? (
              <div className="space-y-5">
                <p className="text-sm leading-6">
                  Tu restaurante y su primer local ya están creados. Falta autorizar el pago seguro
                  para activar el acceso a la sala, las reservas y el equipo.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    // The tenant is still setup_pending here. The billing route is protected by
                    // the operational-tenant middleware, while the tenant home renders the
                    // activation checklist and its payment authorization action.
                    onPress={() => window.location.assign(`/t/${createdTenant.slug}`)}
                    size="lg"
                  >
                    Continuar con el pago seguro
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-5" noValidate onSubmit={(event) => void submit(event)}>
                {step === 1 ? (
                  <>
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold">1. Tu restaurante</h2>
                      <p className="text-muted-foreground text-sm">
                        El identificador será único y formará parte de la URL de tu restaurante.
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="tenant-name">Nombre comercial</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.name ? 'tenant-name-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.name)}
                          id="tenant-name"
                          onChange={(event) => changeName(event.target.value)}
                          placeholder="Ej. Casa Muntaner"
                          required
                          value={name}
                        />
                        <OnboardingFieldError error={fieldErrors.name} field="name" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="tenant-slug">Identificador del restaurante</FieldLabel>
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
                          placeholder="ej. casa-muntaner"
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
                      <h2 className="text-sm font-semibold">2. Datos de facturación</h2>
                      <p className="text-muted-foreground text-sm">
                        Los necesitamos para preparar tu suscripción; el pago se autoriza después.
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="legal-name">Razón social</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.legalName ? 'legal-name-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.legalName)}
                          autoComplete="organization"
                          id="legal-name"
                          onChange={(event) => {
                            setLegalName(event.target.value)
                            clearFieldError('legalName')
                          }}
                          placeholder="Ej. Casa Muntaner, S.L."
                          required
                          value={legalName}
                        />
                        <OnboardingFieldError error={fieldErrors.legalName} field="legalName" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="tax-id">NIF/CIF</FieldLabel>
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
                          placeholder="Ej. B12345674"
                          required
                          spellCheck={false}
                          value={taxId}
                        />
                        <p className="text-muted-foreground text-xs text-pretty" id="tax-id-help">
                          Ejemplos: 12345678Z, X1234567L o B12345674. Comprobamos su formato.
                        </p>
                        <OnboardingFieldError error={fieldErrors.taxId} field="taxId" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="billing-email">Correo de facturación</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.email ? 'billing-email-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.email)}
                          autoComplete="email"
                          id="billing-email"
                          onChange={(event) => {
                            setEmail(event.target.value)
                            clearFieldError('email')
                          }}
                          placeholder="facturacion@casamuntaner.com"
                          required
                          type="email"
                          value={email}
                        />
                        <OnboardingFieldError error={fieldErrors.email} field="email" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="address">Dirección fiscal</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.addressLine ? 'address-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.addressLine)}
                          autoComplete="address-line1"
                          id="address"
                          onChange={(event) => {
                            setAddressLine(event.target.value)
                            clearFieldError('addressLine')
                          }}
                          placeholder="Ej. Carrer de Mallorca, 123"
                          required
                          value={addressLine}
                        />
                        <OnboardingFieldError error={fieldErrors.addressLine} field="addressLine" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="city">Ciudad</FieldLabel>
                        <Input
                          aria-errormessage={fieldErrors.city ? 'city-error' : undefined}
                          aria-invalid={Boolean(fieldErrors.city)}
                          autoComplete="address-level2"
                          id="city"
                          onChange={(event) => {
                            setCity(event.target.value)
                            clearFieldError('city')
                          }}
                          placeholder="Ej. Barcelona"
                          required
                          value={city}
                        />
                        <OnboardingFieldError error={fieldErrors.city} field="city" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="postal-code">Código postal</FieldLabel>
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
                          placeholder="Ej. 08008"
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
                      Revisa los datos. Podrás corregir cualquier bloque antes de crear el
                      restaurante.
                    </p>
                    {[
                      ['Restaurante', name, slug],
                      ['Idioma', defaultLocale === 'ca' ? 'Català' : 'Español', 'Europe/Madrid'],
                      ['Facturación', legalName, `${taxId} · ${email}`],
                      ['Dirección', addressLine, `${postalCode} · ${city}`],
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
                <FormFeedback pendingLabel="Guardando configuración…" state={feedback.state} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    disabled={feedback.pending || step === 1}
                    onPress={() => setStep((current) => (current - 1) as 1 | 2 | 3)}
                    type="button"
                    variant="ghost"
                  >
                    Atrás
                  </Button>
                  <Button disabled={feedback.pending} size="lg" type="submit">
                    {step === 3 ? 'Crear restaurante' : 'Continuar'}
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
