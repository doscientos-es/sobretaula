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
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { tenantSlugCandidate } from '@/features/tenancy'
import {
  invitationEmailRateLimitMessage,
  isInvitationEmailRateLimited,
} from '@/shared/lib/supabase/auth-email-rate-limit'

import { provisionPlatformTenant } from '../application/platform-tenant-provisioning'

const tenantTimezones = [
  { label: 'España peninsular y Baleares', value: 'Europe/Madrid' },
  { label: 'Islas Canarias', value: 'Atlantic/Canary' },
]

/** Owner-only tenant intake; the platform operator never becomes a tenant member. */
export function PlatformTenantProvisioningForm() {
  const feedback = useFormFeedback()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [legalName, setLegalName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [email, setEmail] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [defaultLocale, setDefaultLocale] = useState<'ca' | 'es'>('es')
  const [timezone, setTimezone] = useState('Europe/Madrid')

  function changeName(value: string) {
    setName(value)
    if (!slugEdited) setSlug(tenantSlugCandidate(value))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return
    feedback.setPending()
    try {
      const tenant = await provisionPlatformTenant({
        data: {
          addressLine,
          city,
          defaultLocale,
          email,
          legalName,
          name,
          ownerEmail,
          ownerName,
          postalCode,
          slug,
          taxId,
          timezone,
        },
      })
      window.location.assign(`/admin/tenants/${tenant.tenantId}`)
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? 'Esta dirección de restaurante ya está en uso.'
          : isInvitationEmailRateLimited(error)
            ? `El tenant se ha creado, pero no se ha enviado la invitación al propietario. ${invitationEmailRateLimitMessage}`
            : 'No se ha podido crear el tenant. Revisa los datos e inténtalo de nuevo.',
      )
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Alta manual</CardTitle>
          <CardDescription>
            Crea un tenant en configuración pendiente sin incorporarte al restaurante.
          </CardDescription>
        </div>
        {!isEditing && (
          <Button onPress={() => setIsEditing(true)} size="sm" variant="outline">
            Dar de alta
          </Button>
        )}
      </CardHeader>
      {isEditing && (
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
            <Field>
              <FieldLabel htmlFor="platform-tenant-name">Nombre comercial</FieldLabel>
              <Input
                id="platform-tenant-name"
                onChange={(event) => changeName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-slug">Dirección de SobreTaula</FieldLabel>
              <Input
                id="platform-tenant-slug"
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
              <FieldLabel htmlFor="platform-owner-name">Nombre del propietario</FieldLabel>
              <Input
                id="platform-owner-name"
                onChange={(event) => setOwnerName(event.target.value)}
                required
                value={ownerName}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-owner-email">Correo del propietario</FieldLabel>
              <Input
                autoComplete="email"
                id="platform-owner-email"
                onChange={(event) => setOwnerEmail(event.target.value)}
                required
                type="email"
                value={ownerEmail}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-legal-name">Razón social</FieldLabel>
              <Input
                id="platform-tenant-legal-name"
                onChange={(event) => setLegalName(event.target.value)}
                required
                value={legalName}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-tax-id">NIF/CIF</FieldLabel>
              <Input
                id="platform-tenant-tax-id"
                onChange={(event) => setTaxId(event.target.value)}
                required
                value={taxId}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-billing-email">Correo de facturación</FieldLabel>
              <Input
                autoComplete="email"
                id="platform-tenant-billing-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-address">Dirección fiscal</FieldLabel>
              <Input
                id="platform-tenant-address"
                onChange={(event) => setAddressLine(event.target.value)}
                required
                value={addressLine}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-city">Ciudad</FieldLabel>
              <Input
                id="platform-tenant-city"
                onChange={(event) => setCity(event.target.value)}
                required
                value={city}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-postal-code">Código postal</FieldLabel>
              <Input
                id="platform-tenant-postal-code"
                onChange={(event) => setPostalCode(event.target.value)}
                required
                value={postalCode}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-locale">Idioma predeterminado</FieldLabel>
              <Select
                id="platform-tenant-locale"
                onSelectionChange={(key) => setDefaultLocale(String(key) as 'ca' | 'es')}
                selectedKey={defaultLocale}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="es">Español</SelectItem>
                    <SelectItem id="ca">Catalán</SelectItem>
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-tenant-timezone">Zona horaria</FieldLabel>
              <Select
                id="platform-tenant-timezone"
                isRequired
                onSelectionChange={(key) => setTimezone(String(key))}
                selectedKey={timezone}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    {tenantTimezones.map((timezoneOption) => (
                      <SelectItem id={timezoneOption.value} key={timezoneOption.value}>
                        {timezoneOption.label}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <FormFeedback pendingLabel="Creando tenant…" state={feedback.state} />
              <div className="mt-4 flex items-center gap-3">
                <Button disabled={feedback.pending} type="submit">
                  Crear tenant e invitar al propietario
                </Button>
                <Button
                  disabled={feedback.pending}
                  onPress={() => setIsEditing(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
