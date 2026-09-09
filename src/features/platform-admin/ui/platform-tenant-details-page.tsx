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
import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import { updatePlatformTenantStatus } from '../application/platform-operators'
import {
  updatePlatformTenantConfiguration,
  type PlatformTenantDetail,
} from '../application/platform-tenant-details'
import { getTenantVerifactuHealth } from '../domain/platform-tenant-verifactu'

const euro = new Intl.NumberFormat('es-ES', { currency: 'EUR', style: 'currency' })
const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })

function statusLabel(status: PlatformTenantDetail['tenantStatus']) {
  return {
    active: 'Activo',
    setup_pending: 'Configuración pendiente',
    suspended: 'Suspendido',
    trial: 'Prueba',
  }[status]
}

function formString(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

/** Owner-only detail page for configuration, basic activity and fiscal delivery health. */
export function PlatformTenantDetailsPage({ tenant }: { tenant: PlatformTenantDetail }) {
  const configurationFeedback = useFormFeedback()
  const statusFeedback = useFormFeedback()
  const reload = useLoaderReload()
  const health = getTenantVerifactuHealth({
    certificateConfigured: tenant.certificateConfigured,
    certificateExpiresAt: tenant.certificateExpiresAt,
    environment: tenant.verifactuEnvironment,
    fiscalConfigured: tenant.fiscalIssuerNif !== null,
    invoiceSeriesCount: tenant.invoiceSeriesCount,
    outboxErrorCount: tenant.outboxErrorCount,
  })

  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (configurationFeedback.pending) return
    const values = new FormData(event.currentTarget)
    const defaultLocale = values.get('defaultLocale')
    if (defaultLocale !== 'es' && defaultLocale !== 'ca') return
    configurationFeedback.setPending()
    void updatePlatformTenantConfiguration({
      data: {
        defaultLocale,
        name: formString(values, 'name'),
        tenantId: tenant.tenantId,
        timezone: formString(values, 'timezone'),
      },
    })
      .then(() => {
        configurationFeedback.setSuccess('Configuración guardada y registrada en la auditoría.')
        reload()
      })
      .catch(() => configurationFeedback.setError('No se ha podido guardar la configuración.'))
  }

  function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (statusFeedback.pending) return
    const values = new FormData(event.currentTarget)
    const status = values.get('status')
    if (status !== 'active' && status !== 'suspended') return
    statusFeedback.setPending()
    void updatePlatformTenantStatus({
      data: { reason: formString(values, 'reason'), status, tenantId: tenant.tenantId },
    })
      .then(() => {
        statusFeedback.setSuccess('Estado actualizado y registrado en la auditoría.')
        event.currentTarget.reset()
        reload()
      })
      .catch(() => statusFeedback.setError('No se ha podido actualizar el estado del tenant.'))
  }

  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <Link className="text-muted-foreground mb-3 inline-block text-sm underline" to="/admin">
            Volver al resumen
          </Link>
          <PageHeaderTitle>{tenant.tenantName}</PageHeaderTitle>
          <PageHeaderDescription>
            Tenant <code>{tenant.tenantSlug}</code> · alta {date.format(new Date(tenant.createdAt))}{' '}
            · {statusLabel(tenant.tenantStatus)}
          </PageHeaderDescription>
        </div>
      </PageHeader>

      <section
        aria-label="Estadísticas básicas"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          label="Locales activos"
          value={tenant.activeVenueCount}
          detail={`${tenant.activeMemberCount} miembros activos`}
        />
        <Metric
          label="Reservas (30 días)"
          value={tenant.reservationCountLast30Days}
          detail={`${tenant.closedSessionCountLast30Days} mesas cerradas`}
        />
        <Metric
          label="Cobros (30 días)"
          value={euro.format(tenant.paymentTotalCentsLast30Days / 100)}
          detail="Incluye propinas"
        />
        <Metric
          label="Facturación emitida"
          value={euro.format(tenant.invoiceTotalCents / 100)}
          detail={`${tenant.invoiceCount} facturas · ${tenant.registeredInvoiceCount} registradas`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuración general</CardTitle>
            <CardDescription>
              El slug se mantiene estable para preservar las rutas del restaurante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={saveConfiguration}>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="tenant-name">Nombre del restaurante</FieldLabel>
                <Input defaultValue={tenant.tenantName} id="tenant-name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="tenant-locale">Idioma predeterminado</FieldLabel>
                <select
                  className="border-input h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                  defaultValue={tenant.defaultLocale}
                  id="tenant-locale"
                  name="defaultLocale"
                >
                  <option value="es">Español</option>
                  <option value="ca">Catalán</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="tenant-timezone">Zona horaria IANA</FieldLabel>
                <Input
                  defaultValue={tenant.tenantTimezone}
                  id="tenant-timezone"
                  name="timezone"
                  required
                />
              </Field>
              <div className="md:col-span-2">
                <FormFeedback
                  pendingLabel="Guardando configuración…"
                  state={configurationFeedback.state}
                />
                <Button className="mt-4" disabled={configurationFeedback.pending} type="submit">
                  Guardar configuración
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acceso del tenant</CardTitle>
            <CardDescription>
              La suspensión y reactivación requieren un motivo que queda auditado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveStatus}>
              <Field>
                <FieldLabel htmlFor="tenant-status">Nuevo estado</FieldLabel>
                <select
                  className="border-input h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                  defaultValue=""
                  id="tenant-status"
                  name="status"
                >
                  <option disabled value="">
                    Selecciona una acción…
                  </option>
                  <option value="active">Reactivar tenant</option>
                  <option value="suspended">Suspender tenant</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="tenant-status-reason">Motivo</FieldLabel>
                <Input
                  id="tenant-status-reason"
                  minLength={5}
                  name="reason"
                  placeholder="Motivo obligatorio"
                  required
                />
              </Field>
              <FormFeedback pendingLabel="Actualizando estado…" state={statusFeedback.state} />
              <Button disabled={statusFeedback.pending} type="submit">
                Aplicar cambio de estado
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado Veri*Factu</CardTitle>
            <CardDescription>
              {health.ready
                ? 'Configuración operativa para pruebas.'
                : 'Hay requisitos o incidencias que requieren revisión.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info
                label="Entorno"
                value={
                  tenant.verifactuEnvironment === 'prod'
                    ? 'Producción (bloqueada en MVP)'
                    : tenant.verifactuEnvironment === 'test'
                      ? 'Pruebas'
                      : 'Sin configurar'
                }
              />
              <Info
                label="Identidad fiscal"
                value={
                  tenant.fiscalLegalName
                    ? `${tenant.fiscalLegalName} · ${tenant.fiscalIssuerNif}`
                    : 'Sin configurar'
                }
              />
              <Info
                label="Certificado"
                value={
                  !tenant.certificateConfigured
                    ? 'No cargado'
                    : tenant.certificateExpiresAt
                      ? `Caduca el ${date.format(new Date(tenant.certificateExpiresAt))}`
                      : 'Cargado sin fecha'
                }
              />
              <Info
                label="Última factura"
                value={
                  tenant.lastInvoiceAt
                    ? date.format(new Date(tenant.lastInvoiceAt))
                    : 'Aún no hay facturas'
                }
              />
            </dl>
            <ul className="space-y-2 text-sm">
              {health.items.map((item) => (
                <li className={item.ok ? 'text-success' : 'text-warning'} key={item.label}>
                  {item.ok ? '✓' : '!'} {item.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadena y entregas</CardTitle>
            <CardDescription>
              Los registros fiscales son de solo lectura y no se modifican desde
              superadministración.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Series"
              value={tenant.invoiceSeriesCount}
              detail="Configuradas"
              compact
            />
            <Metric
              label="Registros"
              value={tenant.verifactuLedgerCount}
              detail="En la cadena"
              compact
            />
            <Metric
              label="Cola de envío"
              value={tenant.outboxPendingCount + tenant.outboxErrorCount}
              detail={`${tenant.outboxPendingCount} pendientes · ${tenant.outboxErrorCount} con error`}
              compact
            />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function Metric({
  compact = false,
  detail,
  label,
  value,
}: {
  compact?: boolean
  detail: string
  label: string
  value: number | string
}) {
  return (
    <Card className={compact ? 'shadow-none' : undefined}>
      <CardHeader className={compact ? 'p-4' : undefined}>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
      <CardContent
        className={
          compact ? 'text-muted-foreground px-4 pb-4 text-sm' : 'text-muted-foreground text-sm'
        }
      >
        {detail}
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
