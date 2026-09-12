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
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator, formatMessage, type MessageKey } from '@/shared/lib/i18n/messages'

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
  const locale = useLocale(tenant.defaultLocale)
  const t = createTranslator(locale)
  const message = (key: MessageKey, values: Record<string, string | number> = {}) =>
    formatMessage(locale, key, values)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tenant.timezone,
  })
  const publicUrl =
    typeof window === 'undefined'
      ? `/reservar/${tenant.slug}`
      : `${window.location.origin}/reservar/${tenant.slug}`
  const nextService = metrics.nextReservationStartsAt
    ? timeFormatter.format(new Date(metrics.nextReservationStartsAt))
    : null
  const tenantStatusKey = {
    active: 'tenant.status.active',
    setup_pending: 'tenant.status.setupPending',
    suspended: 'tenant.status.suspended',
    trial: 'tenant.status.trial',
  } as const

  return (
    <section className="space-y-7">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{message('dashboard.greeting')}</PageHeaderTitle>
          <PageHeaderDescription>
            {metrics.pendingReservationsToday > 0
              ? message(
                  metrics.pendingReservationsToday === 1
                    ? 'dashboard.pendingReservation.single'
                    : 'dashboard.pendingReservation.multiple',
                  { count: metrics.pendingReservationsToday },
                )
              : metrics.openSessionCount > 0
                ? message(
                    metrics.openSessionCount === 1
                      ? 'dashboard.openSession.single'
                      : 'dashboard.openSession.multiple',
                    { count: metrics.openSessionCount },
                  )
                : nextService
                  ? message('dashboard.nextService', { time: nextService })
                  : message('dashboard.allSystems', { name: tenant.name })}
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            [
              message('dashboard.reservationsToday'),
              String(metrics.reservationsToday),
              message('dashboard.reservationsThisWeek', { count: metrics.reservationsThisWeek }),
              CalendarCheck2,
              '#5aa6ff',
            ],
            [
              message('dashboard.occupiedTables'),
              String(metrics.occupiedTables),
              message('dashboard.openSessionsNow'),
              Users,
              '#ffb946',
            ],
            [
              message('dashboard.dailyRevenue'),
              new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: 'EUR',
              }).format(metrics.paidTodayCents / 100),
              message('dashboard.paymentsToday'),
              Euro,
              '#64c59a',
            ],
            [
              message('dashboard.nextServiceLabel'),
              metrics.nextReservationStartsAt
                ? timeFormatter.format(new Date(metrics.nextReservationStartsAt))
                : '—',
              metrics.nextReservationCovers === null
                ? message('dashboard.noUpcomingReservations')
                : message('dashboard.expectedGuests', { count: metrics.nextReservationCovers }),
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
          <CardTitle>{message('dashboard.todayPriorities')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.actionItems.length > 0 ? (
            <ul className="divide-border divide-y">
              {metrics.actionItems.map((item) => {
                const venue = venues.find((candidate) => candidate.id === item.venueId)
                if (!venue) return null

                const isPendingReservation = item.kind === 'pending_reservation'
                const actionLabel = isPendingReservation
                  ? message('dashboard.reviewReservation')
                  : message('dashboard.openService')
                const occurredAt = isPendingReservation ? item.startsAt : item.openedAt
                const time = timeFormatter.format(new Date(occurredAt))
                const detail = isPendingReservation
                  ? message('dashboard.partyGuests', { count: item.partySize, time })
                  : message('dashboard.openedSince', { time })

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
                            ? message('dashboard.pendingReservation')
                            : message('dashboard.serviceInProgress')}
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
              <p className="text-muted-foreground">{message('dashboard.noPendingActions')}</p>
            </div>
          )}
          {metrics.noShowsThisWeek > 0 ? (
            <p className="text-muted-foreground border-t pt-3 text-xs">
              {message(
                metrics.noShowsThisWeek === 1
                  ? 'dashboard.noShow.single'
                  : 'dashboard.noShow.multiple',
                { count: metrics.noShowsThisWeek },
              )}
            </p>
          ) : null}
        </CardContent>
      </Card>
      {venues[0] ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium">{message('dashboard.publicBooking.title')}</p>
              <p className="text-muted-foreground text-sm">
                {message('dashboard.publicBooking.description')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="text-primary font-medium underline underline-offset-4"
                params={{ slug: tenant.slug }}
                rel="noreferrer"
                target="_blank"
                to="/reservar/$slug"
              >
                {t('app.customerView')}
              </Link>
              <button
                className="border-border rounded-md border px-3 py-2 text-sm font-medium"
                onClick={() => {
                  const clipboard = navigator.clipboard
                  if (!clipboard) {
                    setCopyFailed(true)
                    return
                  }
                  void clipboard
                    .writeText(publicUrl)
                    .then(() => {
                      setCopied(true)
                      setCopyFailed(false)
                      window.setTimeout(() => setCopied(false), 2000)
                    })
                    .catch(() => {
                      setCopied(false)
                      setCopyFailed(true)
                    })
                }}
                type="button"
              >
                {copied ? message('dashboard.linkCopied') : message('dashboard.copyLink')}
              </button>
              <span aria-live="polite" className="sr-only">
                {copyFailed
                  ? message('dashboard.copyFailed')
                  : copied
                    ? message('dashboard.linkCopied')
                    : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {venues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium">{message('dashboard.noVenues.title')}</p>
              <p className="text-muted-foreground text-sm">
                {message('dashboard.noVenues.description')}
              </p>
            </div>
            <Link
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
              params={{ slug: tenant.slug }}
              to="/t/$slug/l/nuevo"
            >
              {message('dashboard.createFirstVenue')}
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {t('app.tagline')} · {tenant.timezone} · Estado: {t(tenantStatusKey[tenant.status])}
      </p>
    </section>
  )
}
