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

import { groupAreasByFloor, selectFloorPlanVersion, type FloorPlanData } from '@/features/floor-plan'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import type { ServiceBoard } from '../domain/service-board'
import { ServiceActions } from './service-actions'
import { describeStatus } from './service-labels'
import { ServicePlan } from './service-plan'
import { ServiceQueue } from './service-queue'

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
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all')
  const reload = useLoaderReload()
  useEffect(() => {
    const interval = window.setInterval(() => reload(), 30_000)
    const refreshOnFocus = () => reload()
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [reload])
  const activeVersion =
    (selectedAreaId === 'all' ? plan.versions[0] : selectFloorPlanVersion(plan.versions, selectedAreaId)) ??
    (selectedAreaId === 'all' ? plan.versions[0] : undefined)
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
  const areaGroups = groupAreasByFloor(plan.areas)

  useEffect(() => {
    if (selectedAreaId === 'all') return
    const allowed = new Set(visibleTables.map((table) => table.id))
    setSelectedTableIds((current) => {
      const next = current.filter((id) => allowed.has(id))
      return next.length === current.length ? current : next
    })
  }, [selectedAreaId, visibleTables])

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
            Sincronización automática cada 30 segundos · también puedes actualizar ahora.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => reload()} type="button" variant="outline">
          <RefreshCw aria-hidden="true" className="mr-2 size-4" />
          Actualizar sala
        </Button>
      </PageHeader>
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
                    const codes = new Set(plan.placements.filter((placement) => placement.floorPlanVersionId === areaVersion?.id).map((placement) => placement.code))
                    const areaTables = board.tables.filter((table) => codes.has(table.code))
                    const occupied = areaTables.filter((table) => table.status === 'occupied').length
                    return (
                      <button className="border-border hover:bg-muted/60 rounded-lg border p-3 text-left transition-colors" key={area.id} onClick={() => setSelectedAreaId(area.id)} type="button">
                        <span className="text-muted-foreground block text-xs">{area.floorNumber === 0 ? 'Planta baja' : area.floorNumber ? `Planta ${area.floorNumber}` : 'Zona'}</span>
                        <span className="mt-1 block font-medium">{area.name}</span>
                        <span className="text-muted-foreground mt-1 block text-sm">{occupied}/{areaTables.length} ocupadas</span>
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
                {plan.areas.length > 1 && (
                  <div className="mb-4 space-y-2" aria-label="Filtrar por zona">
                    <Button
                      onClick={() => setSelectedAreaId('all')}
                      type="button"
                      variant={selectedAreaId === 'all' ? 'default' : 'outline'}
                    >
                      Todas
                    </Button>
                    {areaGroups.map((group) => (
                      <div key={group.label} className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground w-28 text-xs font-medium">{group.label}</span>
                        {group.areas.map((area) => (
                          <Button key={area.id} onClick={() => setSelectedAreaId(area.id)} type="button" variant={selectedAreaId === area.id ? 'default' : 'outline'}>
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
                {visiblePlacements.length === 0 ? (
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
                )}
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
                  {visibleTables.map((table) => (
                    <li key={table.id}>
                      <Button
                        aria-pressed={selectedTableIds.includes(table.id)}
                        className="w-full justify-start"
                        onClick={() => toggleTable(table.id)}
                        type="button"
                      >
                        {`Mesa ${table.code} · ${describeStatus(table.status)} · ${table.covers ?? table.maxSeats} pax`}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <ServiceActions
            board={board}
            onDone={reload}
            selectedTableIds={selectedTableIds}
            tenantId={tenantId}
            venueId={venueId}
          />
          <ServiceQueue
            board={board}
            onDone={reload}
            selectedTableIds={selectedTableIds}
            tenantId={tenantId}
            venueId={venueId}
          />
        </aside>
      </div>
    </section>
  )
}
