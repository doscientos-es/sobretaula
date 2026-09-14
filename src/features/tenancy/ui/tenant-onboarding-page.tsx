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
import { Building2, CircleCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { SUPPORTED_LOCALES, type Locale } from '@/shared/lib/i18n/locale'
import { useLocale, useLocalePreference } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import { tenantOnboardingErrorMessage } from '../application/onboarding-error'
import { tenantSlugCandidate } from '../application/onboarding-schema'
import { provisionTenantOnboarding } from '../application/provision-tenant-onboarding'

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
  const defaultLocale = selectedLocale ?? interfaceLocale
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
    if (!slugEdited) setSlug(tenantSlugCandidate(value))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < 3) {
      const valid =
        step === 1
          ? Boolean(name.trim() && slug.trim())
          : Boolean(
              legalName.trim() &&
              taxId.trim() &&
              email.trim() &&
              addressLine.trim() &&
              city.trim() &&
              postalCode.trim(),
            )
      if (!valid) {
        feedback.setError(
          step === 1
            ? 'Completa el nombre y la dirección de SobreTaula.'
            : 'Completa todos los datos de facturación.',
        )
        return
      }
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
      feedback.setError(tenantOnboardingErrorMessage(error))
    }
  }

  return (
    <main className="st-auth-shell py-10">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <section className="relative w-full max-w-3xl">
        <div className="mb-6 max-w-xl">
          <h1 className="text-foreground mt-2 text-4xl tracking-[-0.05em]">
            Vamos a preparar tu casa.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Completa los datos esenciales. Configurarás la sala y el equipo justo después.
          </p>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2" aria-label="Progreso del alta">
          {['Restaurante', 'Facturación', 'Activación'].map((label, index) => (
            <div className="bg-background/70 rounded-xl border p-3" key={label}>
              <div className="text-primary mb-1 text-xs font-semibold">0{index + 1}</div>
              <div className="text-sm font-medium">{label}</div>
              <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                <div className={`bg-primary h-full ${index === 0 ? 'w-full' : 'w-0'}`} />
              </div>
            </div>
          ))}
        </div>
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
            <CardTitle>Configura tu restaurante</CardTitle>
            <CardDescription>
              Empieza por los datos básicos. Después prepararemos juntos tu sala, carta, turnos y
              equipo. No se realiza ningún cargo en este paso.
            </CardDescription>
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
                        La dirección de SobreTaula identifica tu espacio y debe ser única.
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="tenant-name">Nombre comercial</FieldLabel>
                        <Input
                          id="tenant-name"
                          onChange={(event) => changeName(event.target.value)}
                          required
                          value={name}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="tenant-slug">Dirección de SobreTaula</FieldLabel>
                        <Input
                          id="tenant-slug"
                          onChange={(event) => {
                            setSlugEdited(true)
                            setSlug(event.target.value)
                          }}
                          pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
                          required
                          value={slug}
                        />
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
                          id="legal-name"
                          onChange={(event) => setLegalName(event.target.value)}
                          required
                          value={legalName}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="tax-id">NIF/CIF</FieldLabel>
                        <Input
                          id="tax-id"
                          onChange={(event) => setTaxId(event.target.value)}
                          required
                          value={taxId}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="billing-email">Correo de facturación</FieldLabel>
                        <Input
                          autoComplete="email"
                          id="billing-email"
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          type="email"
                          value={email}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="address">Dirección fiscal</FieldLabel>
                        <Input
                          id="address"
                          onChange={(event) => setAddressLine(event.target.value)}
                          required
                          value={addressLine}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="city">Ciudad</FieldLabel>
                        <Input
                          id="city"
                          onChange={(event) => setCity(event.target.value)}
                          required
                          value={city}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="postal-code">Código postal</FieldLabel>
                        <Input
                          id="postal-code"
                          onChange={(event) => setPostalCode(event.target.value)}
                          required
                          value={postalCode}
                        />
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
