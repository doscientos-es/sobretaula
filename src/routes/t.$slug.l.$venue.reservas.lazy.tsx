import { createLazyFileRoute } from '@tanstack/react-router'

import { ReservationPage, type ReservationAgendaSearch } from '@/features/reservations'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/reservas')({
  component: ReservationsRoute,
})

function ReservationsRoute() {
  const { services, terms, tenant, venue } = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
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
    />
  )
}
