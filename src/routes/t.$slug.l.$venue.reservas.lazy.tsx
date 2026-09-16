import { useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import {
  ReservationPage,
  reservationsWorkspaceQuery,
  type ReservationAgendaSearch,
} from '@/features/reservations'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/reservas')({
  component: ReservationsRoute,
})

function ReservationsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const workspace = useQuery(reservationsWorkspaceQuery(tenant.id, venue.id))
  if (workspace.isPending) return <TenantRoutePending />
  if (workspace.error) throw workspace.error
  const { services, terms } = workspace.data
  const agendaSearch: ReservationAgendaSearch = {
    ...(search.date ? { date: search.date } : {}),
    ...(search.q ? { query: search.q } : {}),
    ...(search.status ? { status: search.status } : {}),
  }

  return (
    <ReservationPage
      agendaSearch={agendaSearch}
      locale={locale}
      onAgendaSearchChange={(next) =>
        void navigate({
          search: {
            date: next.date,
            q: next.query || undefined,
            status: next.status === 'all' ? undefined : next.status,
          },
        })
      }
      services={services}
      tenantId={tenant.id}
      timezone={tenant.timezone}
      venueId={venue.id}
      terms={terms}
      initialSection={search.section ?? 'agenda'}
    />
  )
}
