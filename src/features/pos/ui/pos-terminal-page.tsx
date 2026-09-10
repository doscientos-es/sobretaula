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
import { Link } from '@tanstack/react-router'

import type { ServiceBoard } from '@/features/service'

import { summarizePosTerminal } from '../domain/terminal-summary'

function TerminalMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Home of the daily terminal. Actions are progressively embedded in this module. */
export function PosTerminalPage({
  board,
  canAccessAccounts,
  slug,
  venue,
}: {
  board: ServiceBoard
  canAccessAccounts: boolean
  slug: string
  venue: string
}) {
  const summary = summarizePosTerminal(board)
  const tableCodes = new Map(board.tables.map((table) => [table.id, table.code]))
  const params = { slug, venue }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>TPV</PageHeaderTitle>
          <PageHeaderDescription>
            La operativa del servicio, desde la mesa hasta el cobro.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TerminalMetric label="Cuentas abiertas" value={summary.activeSessions} />
        <TerminalMetric label="Mesas libres" value={summary.availableTables} />
        <TerminalMetric label="Comandas pendientes" value={summary.pendingItems} />
        <TerminalMetric label="Listo para servir" value={summary.readyItems} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Link
          className="bg-card hover:bg-muted/60 rounded-xl border p-5 transition-colors"
          params={params}
          to="/t/$slug/l/$venue/servicio"
        >
          <span className="font-semibold">Sala y mesas</span>
          <span className="text-muted-foreground mt-1 block text-sm">
            Abrir mesas, recibir reservas y gestionar cambios de sala.
          </span>
        </Link>
        <Link
          className="bg-card hover:bg-muted/60 rounded-xl border p-5 transition-colors"
          params={params}
          to="/t/$slug/l/$venue/reservas"
        >
          <span className="font-semibold">Reservas</span>
          <span className="text-muted-foreground mt-1 block text-sm">
            Consultar llegadas, lista de espera y próximos servicios.
          </span>
        </Link>
        {canAccessAccounts && (
          <Link
            className="bg-card hover:bg-muted/60 rounded-xl border p-5 transition-colors"
            params={params}
            to="/t/$slug/l/$venue/caja"
          >
            <span className="font-semibold">Caja</span>
            <span className="text-muted-foreground mt-1 block text-sm">
              Apertura, movimientos, arqueo y cierres del turno.
            </span>
          </Link>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Cuentas activas</CardTitle>
            <CardDescription>
              Selecciona una mesa para continuar su comanda o cobro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {board.sessions.length === 0 ? (
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
                          className="hover:bg-muted/60 flex flex-col rounded-lg border p-4"
                          params={{ ...params, sessionId: session.id }}
                          to="/t/$slug/l/$venue/cuenta/$sessionId"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex flex-col rounded-lg border p-4">{content}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Atención de sala</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
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
              Las acciones de comandas, cocina y cobro se incorporan progresivamente aquí sin
              duplicar la información de sala.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
