import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  describeSpaceType,
  groupAreasByFloor,
  selectFloorPlanVersion,
  type FloorPlanData,
} from '@/features/floor-plan'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'
import { createBrowserSupabaseClient } from '@/shared/lib/supabase/client'

import { createHandoverSnapshot } from '../application/table-service'
import {
  buildServiceHandover,
  kitchenLoadState,
  kitchenStationLoadState,
  compareServiceHandover,
  type ServiceBoard,
} from '../domain/service-board'
import { ServiceActions } from './service-actions'
import { describeReservationWindow, describeStatus } from './service-labels'
import { ServicePlan } from './service-plan'
import { ServiceQueue } from './service-queue'
import { KitchenQueue } from './kitchen-queue'

export function ServicePage({
  board,
  plan,
  tenantId,
  venueId,
}: {
  board: ServiceBoard
  plan: FloorPlanData
  tenantId: string
  venueId: string
}) {
  const [selectedTableIds, setSelectedTableIds] = useState<readonly string[]>([])
  const [serviceView, setServiceView] = useState<'plan' | 'list'>('plan')
  const [selectedAreaId, setSelectedAreaId] = useState<string>(
    plan.areas.length === 1 ? (plan.areas[0]?.id ?? 'all') : 'all',
  )
  const [lastRefreshAt, setLastRefreshAt] = useState(() => new Date())
  const [clock, setClock] = useState(() => new Date())
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [handoverSaved, setHandoverSaved] = useState(false)
  const [handoverSaving, setHandoverSaving] = useState(false)
  const [handoverError, setHandoverError] = useState(false)
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null)
  const [handoverDate, setHandoverDate] = useState('')
  const reload = useLoaderReload()
  useEffect(() => {
    const refresh = () => {
      const refreshedAt = new Date()
      setLastRefreshAt(refreshedAt)
      setClock(refreshedAt)
      reload()
    }
    const interval = window.setInterval(refresh, 30_000)
    const refreshOnFocus = refresh
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [reload])
  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 15_000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    const client = createBrowserSupabaseClient()
    const refreshFromRealtime = () => {
      setLastRefreshAt(new Date())
      reload()
    }
    const channel = client
      .channel(`service-board-${venueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        refreshFromRealtime,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservation_tables' },
        refreshFromRealtime,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_sessions' },
        refreshFromRealtime,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        refreshFromRealtime,
      )
      .subscribe((status) => {
        const realtimeStatus = String(status)
        if (realtimeStatus === 'SUBSCRIBED') {
          setIsOnline(true)
          refreshFromRealtime()
        } else if (realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT') {
          setIsOnline(false)
        }
      })
    return () => {
      void client.removeChannel(channel)
    }
  }, [reload, venueId])
  useEffect(() => {
    const online = () => {
      setIsOnline(true)
      setLastRefreshAt(new Date())
      reload()
    }
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [reload])
  const activeVersion =
    selectedAreaId === 'all' ? undefined : selectFloorPlanVersion(plan.versions, selectedAreaId)
  const placements = activeVersion
    ? plan.placements.filter((placement) => placement.floorPlanVersionId === activeVersion.id)
    : []
  const visiblePlacements =
    selectedAreaId === 'all'
      ? placements
      : placements.filter((placement) => placement.floorPlanVersionId === activeVersion?.id)
  const visibleTableCodes = new Set(visiblePlacements.map((placement) => placement.code))
  const visibleTables =
    selectedAreaId === 'all'
      ? board.tables
      : board.tables.filter((table) => visibleTableCodes.has(table.code))
  const handover = buildServiceHandover(board, clock)
  const activeVersionIds = new Set(
    plan.areas
      .map((area) => selectFloorPlanVersion(plan.versions, area.id)?.id)
      .filter((id): id is string => Boolean(id)),
  )
  const tableAreaByCode = new Map(
    plan.placements
      .filter((placement) => activeVersionIds.has(placement.floorPlanVersionId))
      .map((placement) => [
        placement.code,
        plan.areas.find((area) =>
          plan.versions.some(
            (version) => version.id === placement.floorPlanVersionId && version.areaId === area.id,
          ),
        ),
      ]),
  )
  const describeTableArea = (code: string) => {
    const area = tableAreaByCode.get(code)
    if (!area) return 'Sin zona'
    const floor =
      area.floorNumber === 0
        ? 'planta baja'
        : area.floorNumber === null || area.floorNumber === undefined
          ? 'sin planta'
          : `planta ${area.floorNumber}`
    return `${area.name} · ${floor}`
  }
  const areaGroups = groupAreasByFloor(plan.areas)
  const dataMayBeStale = clock.getTime() - lastRefreshAt.getTime() > 60_000

  function selectArea(areaId: string) {
    setSelectedAreaId(areaId)
    if (areaId === 'all') return
    const version = selectFloorPlanVersion(plan.versions, areaId)
    const codes = new Set(
      plan.placements
        .filter((placement) => placement.floorPlanVersionId === version?.id)
        .map((placement) => placement.code),
    )
    const allowed = new Set(
      board.tables.filter((table) => codes.has(table.code)).map((table) => table.id),
    )
    setSelectedTableIds((current) => current.filter((id) => allowed.has(id)))
  }

  function toggleTable(tableId: string) {
    setSelectedTableIds((current) =>
      current.includes(tableId) ? current.filter((id) => id !== tableId) : [...current, tableId],
    )
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Servicio</PageHeaderTitle>
          <PageHeaderDescription>
            Consulta el estado de cada mesa, recibe a los comensales y lleva sus cuentas al día.
          </PageHeaderDescription>
          <p className="text-muted-foreground mt-1 text-xs">
            Sincronización automática cada 30 segundos · última actualización{' '}
            <time dateTime={lastRefreshAt.toISOString()}>
              {lastRefreshAt.toLocaleTimeString('es-ES')}
            </time>
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={() => {
            setLastRefreshAt(new Date())
            reload()
          }}
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="mr-2 size-4" />
          Actualizar sala
        </Button>
      </PageHeader>
      {dataMayBeStale && (
        <div
          className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border p-3 text-sm"
          role="alert"
        >
          Los datos pueden estar desactualizados. Actualiza la sala antes de asignar una mesa.
        </div>
      )}
      {!isOnline && (
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
          role="alert"
        >
          Sin conexión. No ejecutes cambios en la sala hasta recuperar la red.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {plan.areas.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Resumen de sala</CardTitle>
                <CardDescription>Ocupación por zona y planta para el encargado.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {plan.areas.map((area) => {
                    const areaVersion = plan.versions.find((version) => version.areaId === area.id)
                    const codes = new Set(
                      plan.placements
                        .filter((placement) => placement.floorPlanVersionId === areaVersion?.id)
                        .map((placement) => placement.code),
                    )
                    const areaTables = board.tables.filter((table) => codes.has(table.code))
                    const occupied = areaTables.filter(
                      (table) => table.status === 'occupied',
                    ).length
                    return (
                      <button
                        className="border-border hover:bg-muted/60 rounded-lg border p-3 text-left transition-colors"
                        key={area.id}
                        onClick={() => selectArea(area.id)}
                        type="button"
                      >
                        <span className="text-muted-foreground block text-xs">
                          {area.floorNumber === 0
                            ? 'Planta baja'
                            : area.floorNumber
                              ? `Planta ${area.floorNumber}`
                              : 'Sin planta'}{' '}
                          · {describeSpaceType(area.spaceType)}
                        </span>
                        <span className="mt-1 block font-medium">{area.name}</span>
                        <span className="text-muted-foreground mt-1 block text-sm">
                          {occupied}/{areaTables.length} ocupadas
                        </span>
                        {area.spaceType &&
                          area.spaceType !== 'indoor' &&
                          area.outdoorOpen === false && (
                            <span className="text-destructive mt-1 block text-xs font-medium">
                              Cerrada temporalmente
                            </span>
                          )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          {activeVersion && (
            <Card>
              <CardHeader>
                <CardTitle>{activeVersion.name}</CardTitle>
                <CardDescription>
                  Selecciona una o varias mesas para ejecutar una acción. El estado se muestra con
                  color, icono y texto para que la sala se entienda de un vistazo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedAreaId !== 'all' &&
                  plan.areas.find((area) => area.id === selectedAreaId)?.outdoorOpen === false && (
                    <div
                      className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-lg border p-3 text-sm"
                      role="alert"
                    >
                      Esta zona exterior está cerrada temporalmente. No asignes nuevas mesas aquí.
                    </div>
                  )}
                {plan.areas.length > 1 && (
                  <div className="mb-4 space-y-2" aria-label="Filtrar por zona">
                    <Button
                      onClick={() => selectArea('all')}
                      type="button"
                      variant={selectedAreaId === 'all' ? 'default' : 'outline'}
                    >
                      Todas
                    </Button>
                    {areaGroups.map((group) => (
                      <div key={group.label} className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground w-28 text-xs font-medium">
                          {group.label}
                        </span>
                        {group.areas.map((area) => (
                          <Button
                            key={area.id}
                            onClick={() => selectArea(area.id)}
                            type="button"
                            variant={selectedAreaId === area.id ? 'default' : 'outline'}
                          >
                            {area.name}
                          </Button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <ul aria-label="Leyenda de estados" className="mb-4 flex flex-wrap gap-2 text-xs">
                  <li className="bg-muted rounded-full px-2 py-1">● Libre</li>
                  <li className="bg-destructive/15 rounded-full px-2 py-1">● Ocupada</li>
                  <li className="bg-primary/15 rounded-full px-2 py-1">● Reservada</li>
                  <li className="bg-warning/15 rounded-full px-2 py-1">● Limpieza</li>
                </ul>
                <div className="mb-4 flex gap-2" aria-label="Vista del servicio">
                  <Button
                    onClick={() => setServiceView('plan')}
                    type="button"
                    variant={serviceView === 'plan' ? 'default' : 'outline'}
                  >
                    Plano en vivo
                  </Button>
                  <Button
                    onClick={() => setServiceView('list')}
                    type="button"
                    variant={serviceView === 'list' ? 'default' : 'outline'}
                  >
                    Vista lista
                  </Button>
                </div>
                {serviceView === 'plan' &&
                  (visiblePlacements.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                      Esta zona todavía no tiene mesas configuradas en el plano activo.
                    </p>
                  ) : (
                    <ServicePlan
                      onToggleTable={toggleTable}
                      placements={visiblePlacements}
                      selectedTableIds={selectedTableIds}
                      states={visibleTables}
                      version={activeVersion}
                    />
                  ))}
              </CardContent>
            </Card>
          )}
          {!activeVersion && selectedAreaId !== 'all' && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">
                  Esta zona no tiene una versión de plano activa. Activa un layout desde el
                  diseñador para poder operar sus mesas.
                </p>
              </CardContent>
            </Card>
          )}
          {serviceView === 'list' && (
            <Card>
              <CardHeader>
                <CardTitle>Mesas</CardTitle>
                <CardDescription>Alternativa accesible al plano en vivo.</CardDescription>
              </CardHeader>
              <CardContent>
                {board.tables.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Este local todavía no tiene mesas activas.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {visibleTables.map((table) => {
                      const reservation = table.reservationId
                        ? board.reservations.find((item) => item.id === table.reservationId)
                        : undefined
                      const preferences = reservation?.preferences?.join(' · ')
                      return (
                        <li key={table.id}>
                          <Button
                            aria-pressed={selectedTableIds.includes(table.id)}
                            className="w-full justify-start"
                            onClick={() => toggleTable(table.id)}
                            type="button"
                          >
                            {`Mesa ${table.code} · ${describeTableArea(table.code)} · ${describeStatus(table.status)}${table.blockReason ? ` · Motivo: ${table.blockReason}` : ''}${table.reservationStartsAt ? ` · ${describeReservationWindow(table.reservationStartsAt)}` : ''}${preferences ? ` · Preferencia: ${preferences}` : ''} · ${table.covers ?? table.maxSeats} pax`}
                            {table.isAccessible ? ' · Accesible' : ''}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {handover.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Handover de turno</CardTitle>
                <CardDescription>
                  Resumen vivo para entregar la sala al siguiente equipo. Pacing objetivo:{' '}
                  {board.pacingTargetMinutes ?? 90} min.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {kitchenLoadState(board.kitchenLoad ?? 0, board.kitchenAlertOrderCount ?? 12) ===
                  'attention' && (
                  <p className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border p-3 text-sm">
                    Cocina: {board.kitchenLoad} comandas abiertas en los últimos 30 minutos.
                  </p>
                )}
                {Object.values(
                  kitchenStationLoadState(
                    board.kitchenLoadByStation ?? {},
                    board.kitchenAlertMinutes ?? 60,
                  ),
                ).some((state) => state === 'attention') && (
                  <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
                    Estaciones con carga alta:{' '}
                    {Object.entries(board.kitchenLoadByStation ?? {})
                      .filter(([, minutes]) => minutes >= (board.kitchenAlertMinutes ?? 60))
                      .map(([station, minutes]) => `${station} (${minutes} min)`)
                      .join(' · ')}
                  </p>
                )}
                {handover.map((section) => {
                  const areaName = plan.areas.find((area) => area.id === section.areaId)?.name
                  const staffNames = section.assignedStaffIds
                    .map((id) => board.staff?.find((member) => member.userId === id)?.displayName)
                    .filter(Boolean)
                  return (
                    <div className="border-border rounded-lg border p-3" key={section.areaId}>
                      <p className="font-medium">{areaName ?? 'Sección'}</p>
                      <p className="text-muted-foreground text-xs">
                        {staffNames.length > 0 ? staffNames.join(', ') : 'Sin equipo asignado'} ·{' '}
                        {section.activeSessions} cuentas abiertas
                      </p>
                      {(section.attentionSessions > 0 ||
                        section.cleaningTables > 0 ||
                        section.blockedTables > 0) && (
                        <p className="text-warning text-xs">
                          {section.attentionSessions > 0
                            ? `${section.attentionSessions} pacing`
                            : ''}
                          {section.cleaningTables > 0
                            ? ` · ${section.cleaningTables} por limpiar`
                            : ''}
                          {section.blockedTables > 0
                            ? ` · ${section.blockedTables} bloqueadas`
                            : ''}
                        </p>
                      )}
                    </div>
                  )
                })}
                <Button
                  disabled={!isOnline || handoverSaving}
                  onClick={() => {
                    setHandoverSaving(true)
                    setHandoverError(false)
                    void createHandoverSnapshot({
                      data: {
                        summary: handover.map((section) => ({
                          ...section,
                          assignedStaffIds: [...section.assignedStaffIds],
                        })),
                        tenantId,
                        venueId,
                      },
                    })
                      .then(() => setHandoverSaved(true))
                      .catch(() => setHandoverError(true))
                      .finally(() => setHandoverSaving(false))
                  }}
                  type="button"
                  variant="outline"
                >
                  {handoverSaving ? 'Guardando…' : 'Guardar entrega de turno'}
                </Button>
                {handoverSaved && (
                  <output className="text-success text-xs">
                    Entrega guardada con fecha y responsable.
                  </output>
                )}
                {handoverError && (
                  <output className="text-destructive text-xs">
                    No se ha podido guardar. Comprueba la conexión y vuelve a intentarlo.
                  </output>
                )}
              </CardContent>
            </Card>
          )}
          {(board.handoverSnapshots?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Entregas anteriores</CardTitle>
                <CardDescription>Últimas 50 instantáneas guardadas de este local.</CardDescription>
                <label className="text-muted-foreground grid gap-1 text-xs" htmlFor="handover-date">
                  Filtrar por fecha
                  <input
                    className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                    id="handover-date"
                    onChange={(event) => setHandoverDate(event.target.value)}
                    type="date"
                    value={handoverDate}
                  />
                </label>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {board.handoverSnapshots
                    ?.filter(
                      (snapshot) =>
                        !handoverDate || snapshot.createdAt.slice(0, 10) === handoverDate,
                    )
                    .map((snapshot) => {
                      const attention = snapshot.summary.reduce(
                        (total, section) => total + section.attentionSessions,
                        0,
                      )
                      const open = snapshot.summary.reduce(
                        (total, section) => total + section.activeSessions,
                        0,
                      )
                      return (
                        <li className="border-border rounded-lg border p-3" key={snapshot.id}>
                          <button
                            aria-expanded={expandedSnapshotId === snapshot.id}
                            className="w-full text-left"
                            onClick={() =>
                              setExpandedSnapshotId((current) =>
                                current === snapshot.id ? null : snapshot.id,
                              )
                            }
                            type="button"
                          >
                            <p className="font-medium">
                              {new Date(snapshot.createdAt).toLocaleString('es-ES', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {open} cuentas abiertas
                              {attention > 0 ? ` · ${attention} en pacing` : ''}
                              {snapshot.createdByName ? ` · ${snapshot.createdByName}` : ''}
                            </p>
                          </button>
                          {expandedSnapshotId === snapshot.id && (
                            <div className="border-border mt-3 space-y-1 border-t pt-3 text-xs">
                              {snapshot.summary.map((section) => {
                                const areaName = plan.areas.find(
                                  (area) => area.id === section.areaId,
                                )?.name
                                return (
                                  <p key={section.areaId}>
                                    <span className="font-medium">{areaName ?? 'Sección'}:</span>{' '}
                                    {section.activeSessions} abiertas · {section.attentionSessions}{' '}
                                    pacing · {section.cleaningTables} por limpiar ·{' '}
                                    {section.blockedTables} bloqueadas
                                  </p>
                                )
                              })}
                              {compareServiceHandover(snapshot.summary, handover).map((delta) => {
                                const changes = [
                                  delta.activeSessionsDelta !== 0
                                    ? `${delta.activeSessionsDelta > 0 ? '+' : ''}${delta.activeSessionsDelta} cuentas`
                                    : '',
                                  delta.attentionSessionsDelta !== 0
                                    ? `${delta.attentionSessionsDelta > 0 ? '+' : ''}${delta.attentionSessionsDelta} pacing`
                                    : '',
                                  delta.cleaningTablesDelta !== 0
                                    ? `${delta.cleaningTablesDelta > 0 ? '+' : ''}${delta.cleaningTablesDelta} por limpiar`
                                    : '',
                                  delta.blockedTablesDelta !== 0
                                    ? `${delta.blockedTablesDelta > 0 ? '+' : ''}${delta.blockedTablesDelta} bloqueadas`
                                    : '',
                                ].filter(Boolean)
                                if (changes.length === 0) return null
                                const areaName = plan.areas.find(
                                  (area) => area.id === delta.areaId,
                                )?.name
                                return (
                                  <p
                                    className="text-primary"
                                    key={`${snapshot.id}-${delta.areaId}`}
                                  >
                                    Cambio en {areaName ?? 'sección'}: {changes.join(' · ')}
                                  </p>
                                )
                              })}
                            </div>
                          )}
                        </li>
                      )
                    })}
                </ul>
                {board.handoverSnapshots?.every(
                  (snapshot) => handoverDate && snapshot.createdAt.slice(0, 10) !== handoverDate,
                ) && <p className="text-muted-foreground text-sm">No hay entregas en esa fecha.</p>}
              </CardContent>
            </Card>
          )}
          <ServiceActions
            areaOpen={
              selectedAreaId === 'all' ||
              plan.areas.find((area) => area.id === selectedAreaId)?.outdoorOpen !== false
            }
            board={board}
            onDone={reload}
            onSuggest={setSelectedTableIds}
            isOnline={isOnline}
            selectedTableIds={selectedTableIds}
            tenantId={tenantId}
            venueId={venueId}
            now={clock}
            {...(selectedAreaId === 'all' ? {} : { areaId: selectedAreaId })}
          />
          <ServiceQueue
            board={board}
            onDone={reload}
            selectedTableIds={selectedTableIds}
            isOnline={isOnline}
            now={clock}
            tenantId={tenantId}
            venueId={venueId}
          />
          <KitchenQueue tickets={board.kitchenTickets ?? []} tenantId={tenantId} venueId={venueId} onDone={reload} />
        </aside>
      </div>
    </section>
  )
}
