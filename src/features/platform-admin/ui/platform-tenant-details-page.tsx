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
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  useFormFeedback,
} from '@doscientos/ui'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import { deletePlatformTenant, updatePlatformTenantStatus } from '../application/platform-operators'
import {
  updatePlatformTenantConfiguration,
  type PlatformTenantDetail,
} from '../application/platform-tenant-details'
import type { PlatformAuditEvent } from '../domain/platform-audit'
import { getTenantVerifactuHealth } from '../domain/platform-tenant-verifactu'
import { PlatformAuditList } from './platform-audit-list'

const euro = new Intl.NumberFormat('es-ES', { currency: 'EUR', style: 'currency' })
const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })
const tenantTimezones = [
  { label: 'España peninsular y Baleares', value: 'Europe/Madrid' },
  { label: 'Islas Canarias', value: 'Atlantic/Canary' },
]

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

function tenantStatusAction(status: PlatformTenantDetail['tenantStatus']) {
  return status === 'suspended'
    ? {
        description: 'Restaurará el acceso operativo al tenant.',
        label: 'Reactivar tenant',
        status: 'active' as const,
      }
    : {
        description: 'Bloqueará el acceso operativo de todos sus miembros.',
        label: 'Suspender tenant',
        status: 'suspended' as const,
      }
}

/** Owner-only detail page for configuration, basic activity and fiscal delivery health. */
export function PlatformTenantDetailsPage({
  auditEvents,
  tenant,
}: {
  auditEvents: readonly PlatformAuditEvent[]
  tenant: PlatformTenantDetail
}) {
  const configurationFeedback = useFormFeedback()
  const statusFeedback = useFormFeedback()
  const deletionFeedback = useFormFeedback()
  const [isEditingConfiguration, setIsEditingConfiguration] = useState(false)
  const [deletionConfirmation, setDeletionConfirmation] = useState('')
  const reload = useLoaderReload()
  const navigate = useNavigate()
  const router = useRouter()
  const statusAction = tenantStatusAction(tenant.tenantStatus)
  const timezoneLabel =
    tenantTimezones.find((timezone) => timezone.value === tenant.tenantTimezone)?.label ??
    tenant.tenantTimezone
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
        setIsEditingConfiguration(false)
        configurationFeedback.setSuccess('Configuración guardada y registrada en la auditoría.')
        reload()
      })
      .catch(() => configurationFeedback.setError('No se ha podido guardar la configuración.'))
  }

  function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (statusFeedback.pending) return
    const form = event.currentTarget
    const values = new FormData(form)
    if (
      !window.confirm(
        `Vas a ${statusAction.status === 'suspended' ? 'suspender' : 'reactivar'} ${tenant.tenantName}. ${statusAction.description}`,
      )
    ) {
      return
    }
    statusFeedback.setPending()
    void updatePlatformTenantStatus({
      data: {
        reason: formString(values, 'reason'),
        status: statusAction.status,
        tenantId: tenant.tenantId,
      },
    })
      .then(() => {
        statusFeedback.setSuccess('Estado actualizado y registrado en la auditoría.')
        form.reset()
        reload()
      })
      .catch(() => statusFeedback.setError('No se ha podido actualizar el estado del tenant.'))
  }

  function deleteTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (deletionFeedback.pending) return
    if (deletionConfirmation !== tenant.tenantSlug) return
    const values = new FormData(event.currentTarget)
    if (
      !window.confirm(
        `Vas a borrar PERMANENTEMENTE ${tenant.tenantName}. Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    deletionFeedback.setPending()
    void deletePlatformTenant({
      data: {
        reason: formString(values, 'reason'),
        tenantId: tenant.tenantId,
      },
    })
      .then(async () => {
        // Invalida las rutas cacheadas (p. ej. por precarga al pasar el ratón
        // sobre "Volver a tenants") para que la lista no siga mostrando un
        // tenant ya archivado.
        await router.invalidate()
        await navigate({ to: '/admin/tenants' })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : ''
        if (message === 'tenant_not_suspended') {
          deletionFeedback.setError('El tenant debe estar suspendido para poder borrarlo.')
        } else if (message === 'tenant_already_deleted') {
          deletionFeedback.setError('Este tenant ya ha sido archivado.')
        } else {
          deletionFeedback.setError('No se ha podido borrar el tenant.')
        }
      })
  }

  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <Link
            className="text-muted-foreground mb-3 inline-block text-sm underline"
            to="/admin/tenants"
          >
            Volver a tenants
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Configuración general</CardTitle>
            <CardDescription>
              El slug se mantiene estable para preservar las rutas del restaurante.
            </CardDescription>
          </div>
          {!isEditingConfiguration && (
            <Button onPress={() => setIsEditingConfiguration(true)} size="sm" variant="outline">
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditingConfiguration ? (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={saveConfiguration}>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="tenant-name">Nombre del restaurante</FieldLabel>
                <Input defaultValue={tenant.tenantName} id="tenant-name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="tenant-locale">Idioma predeterminado</FieldLabel>
                <Select
                  className="w-full"
                  defaultSelectedKey={tenant.defaultLocale}
                  id="tenant-locale"
                  name="defaultLocale"
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
                <FieldLabel htmlFor="tenant-timezone">Zona horaria</FieldLabel>
                <Select
                  className="w-full"
                  defaultSelectedKey={tenant.tenantTimezone}
                  id="tenant-timezone"
                  isRequired
                  name="timezone"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {!tenantTimezones.some(
                        (timezone) => timezone.value === tenant.tenantTimezone,
                      ) && (
                        <SelectItem id={tenant.tenantTimezone}>{tenant.tenantTimezone}</SelectItem>
                      )}
                      {tenantTimezones.map((timezone) => (
                        <SelectItem id={timezone.value} key={timezone.value}>
                          {timezone.label}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center gap-3 md:col-span-2">
                <Button disabled={configurationFeedback.pending} type="submit">
                  Guardar cambios
                </Button>
                <Button
                  disabled={configurationFeedback.pending}
                  onPress={() => setIsEditingConfiguration(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <FormFeedback
                  pendingLabel="Guardando configuración…"
                  state={configurationFeedback.state}
                />
              </div>
            </form>
          ) : (
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <Info
                className="md:col-span-2"
                label="Nombre del restaurante"
                value={tenant.tenantName}
              />
              <Info label="Slug" value={tenant.tenantSlug} />
              <Info label="Estado actual" value={statusLabel(tenant.tenantStatus)} />
              <Info
                label="Idioma predeterminado"
                value={tenant.defaultLocale === 'ca' ? 'Catalán' : 'Español'}
              />
              <Info label="Zona horaria" value={timezoneLabel} />
            </dl>
          )}
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Historial de auditoría</CardTitle>
          <CardDescription>
            Cambios administrativos realizados sobre este tenant. La bitácora es de solo lectura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformAuditList
            emptyDescription="Todavía no hay cambios administrativos registrados para este tenant."
            events={auditEvents}
          />
        </CardContent>
      </Card>

      <section aria-labelledby="tenant-danger-zone">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle id="tenant-danger-zone" className="text-destructive">
              Zona de riesgo
            </CardTitle>
            <CardDescription>
              Estas acciones cambian el acceso operativo del tenant y quedan registradas en la
              auditoría.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
              onSubmit={saveStatus}
            >
              <Field>
                <FieldLabel htmlFor="tenant-status-reason">Motivo de la acción</FieldLabel>
                <Input
                  id="tenant-status-reason"
                  minLength={5}
                  name="reason"
                  placeholder="Motivo obligatorio"
                  required
                />
              </Field>
              <Button
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={statusFeedback.pending}
                type="submit"
                variant="outline"
              >
                {statusAction.label}
              </Button>
              <div className="md:col-span-2">
                <p className="text-muted-foreground text-sm">{statusAction.description}</p>
                <FormFeedback pendingLabel="Actualizando estado…" state={statusFeedback.state} />
              </div>
            </form>
          </CardContent>
        </Card>

        {tenant.tenantStatus === 'suspended' && (
          <Card className="border-destructive/40 mt-6">
            <CardHeader>
              <CardTitle className="text-destructive">Borrado permanente</CardTitle>
              <CardDescription>
                Archiva el tenant de forma irreversible: deja de verse en la consola de plataforma.
                Por obligación legal (Veri*factu / facturación SaaS) el registro y su historial
                fiscal se conservan en la base de datos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={deleteTenant}>
                <Field>
                  <FieldLabel htmlFor="tenant-deletion-reason">Motivo de la acción</FieldLabel>
                  <Input
                    id="tenant-deletion-reason"
                    minLength={5}
                    name="reason"
                    placeholder="Motivo obligatorio"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="tenant-deletion-confirmation">
                    Escribe <strong>{tenant.tenantSlug}</strong> para confirmar
                  </FieldLabel>
                  <Input
                    id="tenant-deletion-confirmation"
                    autoComplete="off"
                    onChange={(event) => setDeletionConfirmation(event.currentTarget.value)}
                    placeholder={tenant.tenantSlug}
                    required
                    value={deletionConfirmation}
                  />
                </Field>
                <div>
                  <Button
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    disabled={
                      deletionFeedback.pending || deletionConfirmation !== tenant.tenantSlug
                    }
                    type="submit"
                    variant="outline"
                  >
                    Borrar tenant definitivamente
                  </Button>
                  <FormFeedback pendingLabel="Borrando tenant…" state={deletionFeedback.state} />
                </div>
              </form>
            </CardContent>
          </Card>
        )}
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

function Info({ className, label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
