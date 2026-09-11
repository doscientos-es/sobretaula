import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MetricCard,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Euro,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

import type { Venue } from '@/features/venues'
import { createTranslator } from '@/shared/lib/i18n/messages'

import type { DashboardMetrics } from '../application/dashboard-metrics'
import type { Tenant } from '../domain/tenant'

export function TenantHomePage({
  metrics,
  tenant,
  venues,
}: {
  metrics: DashboardMetrics
  tenant: Tenant
  venues: readonly Venue[]
}) {
  const t = createTranslator(tenant.defaultLocale)
  const [copied, setCopied] = useState(false)
  const publicUrl =
    typeof window === 'undefined'
      ? `/reservar/${tenant.slug}`
      : `${window.location.origin}/reservar/${tenant.slug}`
  const nextService = metrics.nextReservationStartsAt
    ? new Intl.DateTimeFormat(tenant.defaultLocale, { hour: '2-digit', minute: '2-digit' }).format(
        new Date(metrics.nextReservationStartsAt),
      )
    : null

  return (
    <section className="space-y-7">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Buenos días</PageHeaderTitle>
          <PageHeaderDescription>
            {metrics.pendingReservationsToday > 0
              ? `Hay ${metrics.pendingReservationsToday} reserva${metrics.pendingReservationsToday === 1 ? '' : 's'} pendiente${metrics.pendingReservationsToday === 1 ? '' : 's'} de confirmar hoy.`
              : metrics.openSessionCount > 0
                ? `Hay ${metrics.openSessionCount} servicio${metrics.openSessionCount === 1 ? '' : 's'} en curso.`
                : nextService
                  ? `Todo preparado para el próximo servicio a las ${nextService}.`
                  : `Todos los sistemas funcionan correctamente en ${tenant.name}.`}
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            [
              'Reservas de hoy',
              String(metrics.reservationsToday),
              `${metrics.reservationsThisWeek} esta semana`,
              CalendarCheck2,
              '#5aa6ff',
            ],
            [
              'Mesas ocupadas',
              String(metrics.occupiedTables),
              'Sesiones abiertas ahora',
              Users,
              '#ffb946',
            ],
            [
              'Facturación del día',
              new Intl.NumberFormat(tenant.defaultLocale, {
                style: 'currency',
                currency: 'EUR',
              }).format(metrics.paidTodayCents / 100),
              'Cobros registrados hoy',
              Euro,
              '#64c59a',
            ],
            [
              'Próximo servicio',
              metrics.nextReservationStartsAt
                ? new Intl.DateTimeFormat(tenant.defaultLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(metrics.nextReservationStartsAt))
                : '—',
              metrics.nextReservationCovers === null
                ? 'No hay reservas próximas'
                : `${metrics.nextReservationCovers} comensales previstos`,
              Clock3,
              '#d29cff',
            ],
          ] as [string, string, string, LucideIcon, string][]
        ).map(([label, value, meta, Icon], index) => (
          <MetricCard
            description={meta}
            icon={<Icon />}
            key={String(label)}
            label={label}
            tone={index === 2 ? 'success' : index === 3 ? 'info' : 'default'}
            value={value}
          />
        ))}
      </div>
      <Card>
        <CardHeader className="border-border/70 border-b">
          <CardTitle>Prioridades de hoy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.actionItems.length > 0 ? (
            <ul className="divide-border divide-y">
              {metrics.actionItems.map((item) => {
                const venue = venues.find((candidate) => candidate.id === item.venueId)
                if (!venue) return null

                const isPendingReservation = item.kind === 'pending_reservation'
                const actionLabel = isPendingReservation ? 'Revisar reserva' : 'Abrir servicio'
                const occurredAt = isPendingReservation ? item.startsAt : item.openedAt
                const time = new Intl.DateTimeFormat(tenant.defaultLocale, {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(occurredAt))
                const detail = isPendingReservation
                  ? `${item.partySize} comensales · ${time}`
                  : `Abierto desde ${time}`

                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    key={`${item.kind}-${item.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {isPendingReservation ? (
                        <TriangleAlert className="text-warning mt-0.5 size-4" />
                      ) : (
                        <Clock3 className="text-info mt-0.5 size-4" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {isPendingReservation
                            ? 'Reserva pendiente de confirmar'
                            : 'Servicio en curso'}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {venue.name} · {detail}
                        </p>
                      </div>
                    </div>
                    <Link
                      className="text-primary text-sm font-medium underline underline-offset-4"
                      params={{ slug: tenant.slug, venue: venue.slug }}
                      to={
                        isPendingReservation
                          ? '/t/$slug/l/$venue/reservas'
                          : '/t/$slug/l/$venue/servicio'
                      }
                    >
                      {actionLabel}
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="text-success size-4" />
              <p className="text-muted-foreground">No hay acciones pendientes ahora mismo.</p>
            </div>
          )}
          {metrics.noShowsThisWeek > 0 ? (
            <p className="text-muted-foreground border-t pt-3 text-xs">
              {metrics.noShowsThisWeek} no presentada{metrics.noShowsThisWeek === 1 ? '' : 's'} esta
              semana.
            </p>
          ) : null}
        </CardContent>
      </Card>
      {venues[0] ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium">Tu página pública de reservas</p>
              <p className="text-muted-foreground text-sm">
                Comparte este enlace para que tus clientes reserven sin crear una cuenta.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="text-primary font-medium underline underline-offset-4"
                params={{ slug: tenant.slug }}
                target="_blank"
                to="/reservar/$slug"
              >
                Ver como cliente
              </Link>
              <button
                className="border-border rounded-md border px-3 py-2 text-sm font-medium"
                onClick={() => {
                  const clipboard = navigator.clipboard
                  if (!clipboard) return
                  void clipboard
                    .writeText(publicUrl)
                    .then(() => {
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 2000)
                    })
                    .catch(() => setCopied(false))
                }}
                type="button"
              >
                {copied ? 'Enlace copiado' : 'Copiar enlace'}
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {venues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium">Aún no tienes ningún local</p>
              <p className="text-muted-foreground text-sm">
                Crea el primero para configurar la sala, reservas y cobros.
              </p>
            </div>
            <Link
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
              params={{ slug: tenant.slug }}
              to="/t/$slug/l/nuevo"
            >
              Crear primer local
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {t('app.tagline')} · {tenant.timezone} · Estado: {tenant.status}
      </p>
    </section>
  )
}
