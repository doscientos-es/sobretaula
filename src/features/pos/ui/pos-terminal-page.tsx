import {
  Button,
  cn,
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
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import type { FloorPlanData } from '@/features/floor-plan'
import { seatWalkIn, type ServiceBoard } from '@/features/service'

import { posAccountQuery, posMenuQuery } from '../application/pos-workspace'
import { PosFloorMap } from './pos-floor-map'

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

function areaLabel(area: FloorPlanData['areas'][number]): string {
  if (area.floorNumber === 0) return `${area.name} · Planta baja`
  if (area.floorNumber) return `${area.name} · Planta ${area.floorNumber}`
  return area.name
}

/** Home of the daily terminal. Actions are progressively embedded in this module. */
export function PosTerminalPage({
  accountWorkspace,
  board,
  canAccessAccounts,
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
  plan: FloorPlanData
  selectedSessionId?: string | undefined
  slug: string
  tenantId: string
  venue: string
  venueId: string
}) {
  const tableCodes = new Map(board.tables.map((table) => [table.id, table.code]))
  const params = { slug, venue }
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [newTableId, setNewTableId] = useState<string | null>(null)
  const [newTableCovers, setNewTableCovers] = useState('2')
  const [openingTable, setOpeningTable] = useState(false)
  const [openTableError, setOpenTableError] = useState<string | null>(null)
  const mapFullscreenRef = useRef<HTMLDivElement>(null)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [selectedAreaId, setSelectedAreaId] = useState(plan.areas[0]?.id ?? '')
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
          'flex-1 bg-background',
          isMapFullscreen &&
            'fixed inset-0 z-50 flex min-h-screen flex-col overflow-hidden bg-background p-4 sm:p-6',
        )}
        ref={mapFullscreenRef}
      >
        <div className="flex items-center justify-between gap-3 pb-2">
          {plan.areas.length > 1 ? (
            <div aria-label="Zonas del restaurante" className="flex min-w-0 flex-wrap gap-2">
              {plan.areas.map((area) => (
                <Button
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  size="sm"
                  type="button"
                  variant={selectedAreaId === area.id ? 'default' : 'outline'}
                >
                  {areaLabel(area)}
                </Button>
              ))}
            </div>
          ) : (
            <span />
          )}
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
        </div>
        <PosFloorMap
          board={board}
          onTableClick={handleTableClick}
          plan={plan}
          selectedAreaId={selectedAreaId}
          selectedSessionId={selectedSessionId}
          fullscreen={isMapFullscreen}
          slug={slug}
          venue={venue}
        />
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

  async function openExistingTable(sessionId: string) {
    try {
      await Promise.all([
        queryClient.ensureQueryData(posAccountQuery({ sessionId, tenantId, venueId })),
        queryClient.ensureQueryData(posMenuQuery({ tenantId, venueId })),
      ])
    } finally {
      await navigate({
        params,
        search: { sessionId },
        to: '/t/$slug/l/$venue/tpv',
      })
    }
  }

  function handleTableClick(tableId: string) {
    if (!canAccessAccounts) return
    const table = board.tables.find((candidate) => candidate.id === tableId)
    if (table?.sessionId) {
      void openExistingTable(table.sessionId)
      return
    }
    if (table?.status === 'free') {
      setNewTableId(table.id)
      setNewTableCovers(String(Math.max(1, table.minSeats)))
      setOpenTableError(null)
    }
  }

  return (
    <section className="min-h-[calc(100dvh-2rem)]">
      {renderMapWorkspace()}
      {accountWorkspace && (
        <DialogRoot
          onOpenChange={(open) => {
            if (!open) {
              void navigate({
                params,
                search: {},
                to: '/t/$slug/l/$venue/tpv',
              })
            }
          }}
          open
        >
          <DialogContent
            className="flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0"
            style={{ maxWidth: '90rem', width: 'calc(100vw - 2rem)' }}
          >
            <DialogHeader className="border-border/70 bg-muted/20 shrink-0 border-b px-6 py-5">
              <DialogTitle>{`Mesa ${selectedTableLabel ?? 'seleccionada'}`}</DialogTitle>
              <DialogDescription>
                Añade platos, revisa el total y gestiona el cobro.
              </DialogDescription>
              {selectedSession && (
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>{selectedSession.covers} comensales</span>
                  <SessionElapsed openedAt={selectedSession.openedAt} />
                </div>
              )}
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{accountWorkspace}</div>
            <DialogFooter className="border-border/70 shrink-0 border-t px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Volver al mapa
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      )}
    </section>
  )
}
