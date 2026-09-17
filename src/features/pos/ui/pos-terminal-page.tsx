import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import type { FloorPlanData } from '@/features/floor-plan'
import type { ServiceBoard } from '@/features/service'

import { summarizePosTerminal } from '../domain/terminal-summary'
import { PosFloorMap } from './pos-floor-map'

function TerminalMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-lg border px-3 py-2.5 shadow-none">
      <p className="text-muted-foreground text-xs font-medium tracking-wide">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Home of the daily terminal. Actions are progressively embedded in this module. */
export function PosTerminalPage({
  accountWorkspace,
  board,
  canAccessAccounts,
  canManageCash,
  kitchenWorkspace,
  managementWorkspace,
  plan,
  slug,
  selectedSessionId,
  venue,
}: {
  accountWorkspace?: ReactNode | undefined
  board: ServiceBoard
  canAccessAccounts: boolean
  canManageCash: boolean
  kitchenWorkspace?: ReactNode | undefined
  managementWorkspace?: ReactNode | undefined
  plan: FloorPlanData
  selectedSessionId?: string | undefined
  slug: string
  venue: string
}) {
  const summary = summarizePosTerminal(board)
  const tableCodes = new Map(board.tables.map((table) => [table.id, table.code]))
  const params = { slug, venue }
  const navigate = useNavigate()

  function handleTableClick(tableId: string) {
    if (!canAccessAccounts) return
    const table = board.tables.find((candidate) => candidate.id === tableId)
    if (table?.sessionId) {
      void navigate({
        params,
        search: { sessionId: table.sessionId },
        to: '/t/$slug/l/$venue/tpv',
      })
      return
    }
    void navigate({ params, search: {}, to: '/t/$slug/l/$venue/servicio' })
  }

  return (
    <section className="space-y-4">
      <PageHeader className="border-border/70 border-b pb-4">
        <div>
          <PageHeaderTitle>TPV</PageHeaderTitle>
          <PageHeaderDescription>
            La operativa del servicio, desde la mesa hasta el cobro.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <TerminalMetric label="Cuentas abiertas" value={summary.activeSessions} />
        <TerminalMetric label="Mesas libres" value={summary.availableTables} />
        <TerminalMetric label="Comandas pendientes" value={summary.pendingItems} />
        <TerminalMetric label="Listo para servir" value={summary.readyItems} />
      </div>
      <Card>
        <CardHeader className="px-4 py-4 sm:px-6">
          <CardTitle>Mapa de sala</CardTitle>
          <CardDescription>
            Pulsa una mesa ocupada para abrir su comanda y añadir recetas, bebidas o cualquier otro
            producto.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-0 sm:px-6">
          <PosFloorMap
            board={board}
            onTableClick={handleTableClick}
            plan={plan}
            selectedSessionId={selectedSessionId}
            slug={slug}
            venue={venue}
          />
        </CardContent>
      </Card>
      <div className="grid gap-2 lg:grid-cols-4">
        <Link
          className="group bg-card hover:bg-muted/40 focus-visible:outline-ring rounded-lg border p-3 shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          params={params}
          to="/t/$slug/l/$venue/servicio"
        >
          <span className="flex items-center justify-between gap-3 font-semibold">
            Sala y mesas
            <ArrowUpRight
              aria-hidden="true"
              className="text-muted-foreground size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
            />
          </span>
          <span className="text-muted-foreground mt-1 block text-sm">
            Abrir mesas, recibir reservas y gestionar cambios de sala.
          </span>
        </Link>
        <Link
          className="group bg-card hover:bg-muted/40 focus-visible:outline-ring rounded-lg border p-3 shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          params={params}
          to="/t/$slug/l/$venue/reservas"
        >
          <span className="flex items-center justify-between gap-3 font-semibold">
            Reservas
            <ArrowUpRight
              aria-hidden="true"
              className="text-muted-foreground size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
            />
          </span>
          <span className="text-muted-foreground mt-1 block text-sm">
            Consultar llegadas, lista de espera y próximos servicios.
          </span>
        </Link>
        <Link
          className="group bg-card hover:bg-muted/40 focus-visible:outline-ring rounded-lg border p-3 shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          params={params}
          to="/t/$slug/l/$venue/fichaje-terminal"
        >
          <span className="flex items-center justify-between gap-3 font-semibold">
            Fichaje
            <ArrowUpRight
              aria-hidden="true"
              className="text-muted-foreground size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
            />
          </span>
          <span className="text-muted-foreground mt-1 block text-sm">
            Registra entrada, pausas y salida antes de empezar el servicio.
          </span>
        </Link>
        {canManageCash && (
          <Link
            className="group bg-card hover:bg-muted/40 focus-visible:outline-ring rounded-lg border p-3 shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            params={params}
            to="/t/$slug/l/$venue/caja"
          >
            <span className="flex items-center justify-between gap-3 font-semibold">
              Caja
              <ArrowUpRight
                aria-hidden="true"
                className="text-muted-foreground size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
              />
            </span>
            <span className="text-muted-foreground mt-1 block text-sm">
              Apertura, movimientos, arqueo y cierres del turno.
            </span>
          </Link>
        )}
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="px-4 py-4">
            <CardTitle>{accountWorkspace ? 'Comanda seleccionada' : 'Cuentas activas'}</CardTitle>
            <CardDescription>
              {accountWorkspace
                ? 'Apunta, anula y consulta las líneas sin salir del TPV.'
                : 'Selecciona una mesa para continuar su comanda o cobro.'}
            </CardDescription>
            {accountWorkspace && canAccessAccounts && (
              <Link
                className="text-primary text-sm font-medium"
                params={params}
                search={{}}
                to="/t/$slug/l/$venue/tpv"
              >
                Cambiar mesa
              </Link>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0">
            {accountWorkspace ??
              (board.sessions.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No hay cuentas abiertas en este momento.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {board.sessions.map((session) => {
                    const label = session.tableIds.map((id) => tableCodes.get(id) ?? id).join(' + ')
                    const content = (
                      <>
                        <span className="font-medium">Mesa {label}</span>
                        <span className="text-muted-foreground text-sm">
                          {session.covers} comensales · abierta
                        </span>
                      </>
                    )
                    return (
                      <li key={session.id}>
                        {canAccessAccounts ? (
                          <Link
                            className="group hover:bg-muted/40 hover:border-border-strong focus-visible:outline-ring flex flex-col rounded-lg border p-3 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--ui-shadow-hairline)] focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transform-none"
                            params={params}
                            search={{ sessionId: session.id }}
                            to="/t/$slug/l/$venue/tpv"
                          >
                            <span className="flex items-center justify-between gap-3">
                              {content}
                              <ArrowUpRight
                                aria-hidden="true"
                                className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
                              />
                            </span>
                          </Link>
                        ) : (
                          <div className="flex flex-col rounded-md border p-3">{content}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-4 py-4">
            <CardTitle>Atención de sala</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pt-0 text-sm">
            <p>
              <strong>{summary.reservedTables}</strong> mesas reservadas
            </p>
            <p>
              <strong>{summary.cleaningTables}</strong> pendientes de limpiar
            </p>
            <p>
              <strong>{summary.blockedTables}</strong> mesas bloqueadas
            </p>
            <p className="text-muted-foreground border-t pt-3">
              Selecciona una cuenta para continuar con la comanda o el cobro.
            </p>
          </CardContent>
        </Card>
      </div>
      {kitchenWorkspace}
      {managementWorkspace}
    </section>
  )
}
