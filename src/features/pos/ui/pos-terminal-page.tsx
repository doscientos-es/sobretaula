import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
} from '@doscientos/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import type { FloorPlanData } from '@/features/floor-plan'
import { seatWalkIn, type ServiceBoard } from '@/features/service'

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

function SessionElapsed({ openedAt }: { openedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const opened = new Date(openedAt).getTime()
  const elapsedMinutes = Number.isFinite(opened)
    ? Math.max(0, Math.floor((now - opened) / 60_000))
    : 0
  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60
  return (
    <span className="text-muted-foreground text-xs">
      {hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`} en mesa
    </span>
  )
}

/** Home of the daily terminal. Actions are progressively embedded in this module. */
export function PosTerminalPage({
  accountWorkspace,
  board,
  canAccessAccounts,
  kitchenWorkspace,
  plan,
  slug,
  selectedSessionId,
  tenantId,
  venue,
  venueId,
}: {
  accountWorkspace?: ReactNode | undefined
  board: ServiceBoard
  canAccessAccounts: boolean
  kitchenWorkspace?: ReactNode | undefined
  plan: FloorPlanData
  selectedSessionId?: string | undefined
  slug: string
  tenantId: string
  venue: string
  venueId: string
}) {
  const summary = summarizePosTerminal(board)
  const tableCodes = new Map(board.tables.map((table) => [table.id, table.code]))
  const params = { slug, venue }
  const navigate = useNavigate()
  const [newTableId, setNewTableId] = useState<string | null>(null)
  const [newTableCovers, setNewTableCovers] = useState('2')
  const [openingTable, setOpeningTable] = useState(false)
  const [openTableError, setOpenTableError] = useState<string | null>(null)
  const mapFullscreenRef = useRef<HTMLDivElement>(null)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const selectedSession = board.sessions.find((session) => session.id === selectedSessionId)
  const selectedTableLabel = selectedSession?.tableIds
    .map((id) => tableCodes.get(id) ?? id)
    .join(' + ')
  const newTable = board.tables.find((table) => table.id === newTableId)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMapFullscreen(document.fullscreenElement === mapFullscreenRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function toggleMapFullscreen() {
    const element = mapFullscreenRef.current
    if (!element) return
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen()
      } else if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else {
        setIsMapFullscreen((current) => !current)
      }
    } catch {
      setIsMapFullscreen(false)
    }
  }

  async function openTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newTable || openingTable) return
    const covers = Number(newTableCovers)
    if (!Number.isInteger(covers) || covers < newTable.minSeats || covers > newTable.maxSeats) {
      setOpenTableError(`Indica entre ${newTable.minSeats} y ${newTable.maxSeats} comensales.`)
      return
    }
    setOpeningTable(true)
    setOpenTableError(null)
    try {
      const result = await seatWalkIn({
        data: {
          covers,
          operationId: crypto.randomUUID(),
          tableIds: [newTable.id],
          tenantId,
          venueId,
        },
      })
      setNewTableId(null)
      await navigate({
        params,
        search: { sessionId: result.sessionId },
        to: '/t/$slug/l/$venue/tpv',
      })
    } catch {
      setOpenTableError('No se ha podido abrir la mesa. Actualiza el mapa e inténtalo de nuevo.')
    } finally {
      setOpeningTable(false)
    }
  }

  function renderMapWorkspace() {
    return (
      <div
        className={cn(
          'bg-background',
          isMapFullscreen && 'fixed inset-0 z-50 min-h-screen overflow-y-auto p-4 sm:p-6',
        )}
        ref={mapFullscreenRef}
      >
        <Card className={isMapFullscreen ? 'mx-auto max-w-[1600px]' : undefined}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <CardTitle>Mapa de sala</CardTitle>
              <CardDescription>
                Pulsa una mesa ocupada para abrir su comanda y añadir recetas, bebidas o cualquier
                otro producto.
              </CardDescription>
            </div>
            <Button
              aria-label={
                isMapFullscreen ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'
              }
              onClick={() => void toggleMapFullscreen()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isMapFullscreen ? (
                <Minimize2 aria-hidden="true" className="size-4" />
              ) : (
                <Maximize2 aria-hidden="true" className="size-4" />
              )}
              <span className="hidden sm:inline">
                {isMapFullscreen ? 'Salir' : 'Pantalla completa'}
              </span>
            </Button>
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
        {newTable && (
          <DialogRoot
            onOpenChange={(open) => {
              if (!open && !openingTable) setNewTableId(null)
            }}
            open
          >
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{`Abrir Mesa ${newTable.code}`}</DialogTitle>
                <DialogDescription>
                  Indica los comensales para abrir la cuenta y empezar a apuntar la comanda.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4" onSubmit={(event) => void openTable(event)}>
                <Field>
                  <FieldLabel htmlFor="new-table-covers">Comensales</FieldLabel>
                  <Input
                    id="new-table-covers"
                    max={newTable.maxSeats}
                    min={newTable.minSeats}
                    onChange={(event) => setNewTableCovers(event.target.value)}
                    type="number"
                    value={newTableCovers}
                  />
                </Field>
                {openTableError && (
                  <p className="text-destructive text-sm" role="alert">
                    {openTableError}
                  </p>
                )}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button disabled={openingTable} type="button" variant="outline">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button disabled={openingTable} type="submit">
                    {openingTable ? 'Abriendo…' : 'Abrir mesa'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </DialogRoot>
        )}
      </div>
    )
  }

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
    if (table?.status === 'free') {
      setNewTableId(table.id)
      setNewTableCovers(String(Math.max(1, table.minSeats)))
      setOpenTableError(null)
    }
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
      {accountWorkspace ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]">
          <div className="min-w-0">{renderMapWorkspace()}</div>
          <aside className="min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
            <Card>
              <CardHeader className="border-border/70 gap-3 border-b px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{`Mesa ${selectedTableLabel ?? 'seleccionada'}`}</CardTitle>
                    <CardDescription>Comanda, detalles y cobro</CardDescription>
                  </div>
                  <Link
                    className="text-primary shrink-0 text-sm font-medium"
                    params={params}
                    search={{}}
                    to="/t/$slug/l/$venue/tpv"
                  >
                    Cambiar
                  </Link>
                </div>
                {selectedSession && (
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>{selectedSession.covers} comensales</span>
                    <SessionElapsed openedAt={selectedSession.openedAt} />
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-3 pt-4 sm:px-4">{accountWorkspace}</CardContent>
            </Card>
          </aside>
        </div>
      ) : (
        renderMapWorkspace()
      )}
      <div className="grid gap-2 lg:grid-cols-3">
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
      </div>
      {!accountWorkspace && (
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
                      const label = session.tableIds
                        .map((id) => tableCodes.get(id) ?? id)
                        .join(' + ')
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
      )}
      {kitchenWorkspace}
    </section>
  )
}
