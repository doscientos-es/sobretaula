import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { useMemo, useState } from 'react'

import {
  PLATFORM_AUDIT_ACTIONS,
  platformAuditActionLabel,
  type PlatformAuditEvent,
} from '../domain/platform-audit'
import { PlatformAuditList } from './platform-audit-list'

/** Lets platform owners review, search and filter the latest immutable audit events. */
export function PlatformAuditPage({ events }: { events: readonly PlatformAuditEvent[] }) {
  const [action, setAction] = useState<'all' | PlatformAuditEvent['action']>('all')
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    return events.filter((event) => {
      const eventDate = event.createdAt.slice(0, 10)
      const matchesQuery =
        !normalizedQuery ||
        [event.actor, event.summary, event.target]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(normalizedQuery)
      return (
        (action === 'all' || event.action === action) &&
        matchesQuery &&
        (!fromDate || eventDate >= fromDate) &&
        (!toDate || eventDate <= toDate)
      )
    })
  }, [action, events, fromDate, query, toDate])

  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Auditoría de plataforma</PageHeaderTitle>
          <PageHeaderDescription>
            Consulta los últimos 100 eventos inmutables de configuración, accesos y tenants.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Filtrar actividad</CardTitle>
          <CardDescription>
            Mostrando {visibleEvents.length} de {events.length} eventos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            aria-label="Buscar en auditoría"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Actor, tenant o detalle…"
            value={query}
          />
          <select
            aria-label="Filtrar por acción de auditoría"
            className="border-input h-10 rounded-md border bg-transparent px-3 text-sm"
            onChange={(event) =>
              setAction(event.target.value as 'all' | PlatformAuditEvent['action'])
            }
            value={action}
          >
            <option value="all">Todas las acciones</option>
            {PLATFORM_AUDIT_ACTIONS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {platformAuditActionLabel(candidate)}
              </option>
            ))}
          </select>
          <Input
            aria-label="Desde fecha"
            onChange={(event) => setFromDate(event.target.value)}
            type="date"
            value={fromDate}
          />
          <Input
            aria-label="Hasta fecha"
            onChange={(event) => setToDate(event.target.value)}
            type="date"
            value={toDate}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Eventos recientes</CardTitle>
          <CardDescription>La bitácora no admite modificaciones ni borrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformAuditList
            emptyDescription="No hay eventos que coincidan con los filtros seleccionados."
            events={visibleEvents}
          />
        </CardContent>
      </Card>
    </main>
  )
}
