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
import { useState } from 'react'

import type { FloorPlanData } from '@/features/floor-plan'
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
  const reload = useLoaderReload()
  const activeVersion = plan.versions[0]
  const placements = activeVersion
    ? plan.placements.filter((placement) => placement.floorPlanVersionId === activeVersion.id)
    : []

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
        </div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {activeVersion && (
            <Card>
              <CardHeader>
                <CardTitle>{activeVersion.name}</CardTitle>
                <CardDescription>
                  Rojo ocupada, verde reservada, gris libre. Selecciona mesas en la lista.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServicePlan
                  onToggleTable={toggleTable}
                  placements={placements}
                  selectedTableIds={selectedTableIds}
                  states={board.tables}
                  version={activeVersion}
                />
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
                  {board.tables.map((table) => (
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
