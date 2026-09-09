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
import { useState, type FormEvent } from 'react'

import { tenantSlugCandidate } from '../application/onboarding-schema'
import { provisionTenantOnboarding } from '../application/provision-tenant-onboarding'

export function TenantOnboardingPage() {
  const feedback = useFormFeedback()
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

  function changeName(value: string) {
    setName(value)
    if (!slugEdited) setSlug(tenantSlugCandidate(value))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    try {
      const tenant = await provisionTenantOnboarding({
        data: {
          addressLine,
          city,
          defaultLocale: 'es',
          email,
          legalName,
          name,
          postalCode,
          slug,
          taxId,
          timezone: 'Europe/Madrid',
        },
      })
      setCreatedTenant(tenant)
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? 'Esta dirección de restaurante ya está en uso.'
          : 'No se ha podido guardar el alta. Revisa los datos e inténtalo de nuevo.',
      )
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
              SobreTaula Sala cuesta 149 € al mes, sin IVA, e incluye un local. Antes de activar el
              restaurante te solicitaremos la autorización segura de pago.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {createdTenant ? (
              <div className="space-y-5">
                <p className="text-sm leading-6">
                  Tu restaurante ya está creado. Puedes dejar preparado VERI*FACTU ahora o continuar
                  y configurarlo desde Facturación cuando tengas el certificado a mano.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onPress={() => window.location.assign(`/t/${createdTenant.slug}/facturacion`)}
                    size="lg"
                  >
                    Configurar VERI*FACTU ahora
                  </Button>
                  <Button
                    onPress={() => window.location.assign(`/t/${createdTenant.slug}`)}
                    size="lg"
                    variant="outline"
                  >
                    Lo haré más tarde
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={(event) => void submit(event)}>
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
                <FormFeedback pendingLabel="Guardando configuración…" state={feedback.state} />
                <Button disabled={feedback.pending} size="lg" type="submit">
                  Continuar con el pago
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
