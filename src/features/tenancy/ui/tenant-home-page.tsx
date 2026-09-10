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
import { CalendarCheck2, Clock3, Euro, Users, type LucideIcon } from 'lucide-react'
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

  return (
    <section className="space-y-7">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Buenos días</PageHeaderTitle>
          <PageHeaderDescription>
            Esto es lo que está pasando hoy en {tenant.name}.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            [
              'Reservas de hoy',
              String(metrics.reservationsToday),
              'Confirmadas o pendientes',
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
        <CardHeader className="border-b">
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            La actividad detallada se consulta en tiempo real desde Servicio, Reservas y Cuenta.
          </p>
          {venues[0] ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                className="text-primary underline underline-offset-4"
                params={{ slug: tenant.slug, venue: venues[0].slug }}
                to="/t/$slug/l/$venue/servicio"
              >
                Abrir servicio
              </Link>
              <Link
                className="text-primary underline underline-offset-4"
                params={{ slug: tenant.slug, venue: venues[0].slug }}
                to="/t/$slug/l/$venue/reservas"
              >
                Gestionar reservas
              </Link>
            </div>
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
      <p className="text-muted-foreground text-xs">
        {t('app.tagline')} · {tenant.timezone} · Estado: {tenant.status}
      </p>
    </section>
  )
}
