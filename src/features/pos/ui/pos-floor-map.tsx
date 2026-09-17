import { Button, cn } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import type { FloorPlanArea, FloorPlanData, PlanElementKind } from '@/features/floor-plan'
import type { ServiceBoard, ServiceTableStatus } from '@/features/service'

const TABLE_FILL: Record<ServiceTableStatus, string> = {
  blocked: 'var(--muted-foreground)',
  cleaning: 'var(--warning)',
  free: 'var(--muted-foreground)',
  occupied: 'var(--destructive)',
  reserved: 'var(--primary)',
}

const ELEMENT_FILL: Record<PlanElementKind, string> = {
  bathroom: 'var(--muted)',
  bar: 'var(--accent)',
  door: 'var(--background)',
  exit: 'var(--background)',
  kitchen: 'var(--accent)',
  label: 'var(--muted)',
  obstacle: 'var(--muted)',
  other: 'var(--muted)',
  pillar: 'var(--muted)',
  plant: 'var(--success)',
  stairs: 'var(--muted)',
  wall: 'var(--muted-foreground)',
  window: 'var(--background)',
}

function tableStatusLabel(status: ServiceTableStatus | undefined): string {
  if (status === 'occupied') return 'Ocupada'
  if (status === 'reserved') return 'Reservada'
  if (status === 'cleaning') return 'Por limpiar'
  if (status === 'blocked') return 'Bloqueada'
  return 'Libre'
}

function areaLabel(area: FloorPlanArea): string {
  if (area.floorNumber === 0) return `${area.name} · Planta baja`
  if (area.floorNumber) return `${area.name} · Planta ${area.floorNumber}`
  return area.name
}

export function PosFloorMap({
  board,
  plan,
  selectedSessionId,
  onTableClick,
  slug,
  venue,
}: {
  board: ServiceBoard
  plan: FloorPlanData
  selectedSessionId?: string | undefined
  onTableClick: (tableId: string) => void
  slug: string
  venue: string
}) {
  const [selectedAreaId, setSelectedAreaId] = useState(plan.areas[0]?.id ?? '')
  const activeArea = plan.areas.find((area) => area.id === selectedAreaId) ?? plan.areas[0]
  const placements = activeArea
    ? plan.placements.filter((placement) => placement.areaId === activeArea.id)
    : []
  const elements = activeArea
    ? plan.elements.filter((element) => element.areaId === activeArea.id)
    : []
  const tableById = new Map(board.tables.map((table) => [table.id, table]))

  return (
    <div className="space-y-4">
      {plan.areas.length > 1 && (
        <div aria-label="Zonas del restaurante" className="flex flex-wrap gap-2">
          {plan.areas.map((area) => (
            <Button
              key={area.id}
              onClick={() => setSelectedAreaId(area.id)}
              type="button"
              variant={activeArea?.id === area.id ? 'default' : 'outline'}
            >
              {areaLabel(area)}
            </Button>
          ))}
        </div>
      )}

      {!activeArea ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          <p>Este local todavía no tiene un plano configurado.</p>
          <Link
            className="text-primary mt-3 inline-flex font-medium underline underline-offset-4"
            params={{ slug, venue }}
            to="/t/$slug/l/$venue/plano"
          >
            Configurar el plano del restaurante
          </Link>
        </div>
      ) : placements.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          <p>{activeArea.name} todavía no tiene mesas colocadas en el plano.</p>
          <Link
            className="text-primary mt-3 inline-flex font-medium underline underline-offset-4"
            params={{ slug, venue }}
            to="/t/$slug/l/$venue/plano"
          >
            Configurar mesas en el plano
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-muted/20 overflow-hidden rounded-2xl border p-2 shadow-[var(--ui-shadow-hairline)] sm:p-4">
            <svg
              aria-label={`Mapa interactivo de ${activeArea.name}`}
              className="bg-background h-[clamp(28rem,62dvh,48rem)] min-h-[420px] w-full rounded-xl"
              preserveAspectRatio="xMidYMid meet"
              viewBox={`0 0 ${activeArea.widthCm} ${activeArea.heightCm}`}
            >
              <title>{`Mapa de ${activeArea.name}. Pulsa una mesa para abrir su comanda.`}</title>
              <rect
                fill="var(--background)"
                height={activeArea.heightCm}
                rx="24"
                stroke="var(--border)"
                strokeWidth="8"
                width={activeArea.widthCm}
                x="0"
                y="0"
              />
              {elements.map((element) => (
                <g aria-hidden="true" key={element.id}>
                  <rect
                    fill={ELEMENT_FILL[element.kind]}
                    fillOpacity={element.kind === 'wall' ? 0.55 : 0.35}
                    height={element.heightCm}
                    rx="8"
                    stroke="var(--border)"
                    strokeWidth="3"
                    width={element.widthCm}
                    x={element.xCm}
                    y={element.yCm}
                  />
                  {element.label && (
                    <text
                      fill="var(--muted-foreground)"
                      fontSize={Math.max(18, Math.min(30, element.heightCm / 3))}
                      textAnchor="middle"
                      x={element.xCm + element.widthCm / 2}
                      y={element.yCm + element.heightCm / 2}
                    >
                      {element.label}
                    </text>
                  )}
                </g>
              ))}
              {placements.map((placement) => {
                const table = tableById.get(placement.id)
                const status = table?.status ?? 'free'
                const selected = table?.sessionId === selectedSessionId
                return (
                  <g
                    aria-hidden="true"
                    className="cursor-pointer outline-none"
                    key={placement.id}
                    onClick={() => onTableClick(placement.id)}
                  >
                    <rect
                      fill={TABLE_FILL[status]}
                      fillOpacity={selected ? 1 : 0.84}
                      height={placement.heightCm}
                      rx={Math.min(placement.widthCm, placement.heightCm) / 5}
                      stroke={selected ? 'var(--foreground)' : 'var(--background)'}
                      strokeWidth={selected ? 12 : 6}
                      width={placement.widthCm}
                      x={placement.xCm}
                      y={placement.yCm}
                    />
                    <text
                      fill="var(--background)"
                      fontSize={Math.max(28, Math.min(58, placement.widthCm / 3))}
                      fontWeight="700"
                      textAnchor="middle"
                      x={placement.xCm + placement.widthCm / 2}
                      y={placement.yCm + placement.heightCm / 2}
                    >
                      {placement.code}
                    </text>
                    <text
                      fill="var(--background)"
                      fontSize={Math.max(14, Math.min(24, placement.widthCm / 6))}
                      textAnchor="middle"
                      x={placement.xCm + placement.widthCm / 2}
                      y={placement.yCm + placement.heightCm / 2 + 34}
                    >
                      {tableStatusLabel(status)}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <ul aria-label="Mesas del mapa" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {placements.map((placement) => {
              const table = tableById.get(placement.id)
              const status = table?.status ?? 'free'
              const selected = table?.sessionId === selectedSessionId
              return (
                <li key={`table-${placement.id}`}>
                  <button
                    aria-label={`Mesa ${placement.code}: ${tableStatusLabel(status)}${table?.covers ? `, ${table.covers} comensales` : ''}`}
                    aria-pressed={selected}
                    className={cn(
                      'hover:bg-muted/50 focus-visible:outline-ring flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                      selected && 'border-foreground bg-muted/50',
                    )}
                    onClick={() => onTableClick(placement.id)}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: TABLE_FILL[status] }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">Mesa {placement.code}</span>
                      <span className="text-muted-foreground block text-xs">
                        {tableStatusLabel(status)}
                        {table?.covers ? ` · ${table.covers} pax` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <ul
            aria-label="Leyenda del mapa"
            className="text-muted-foreground flex flex-wrap gap-2 text-xs"
          >
            {(['free', 'occupied', 'reserved', 'cleaning', 'blocked'] as const).map((status) => (
              <li className="flex items-center gap-1.5" key={status}>
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: TABLE_FILL[status] }}
                />
                {tableStatusLabel(status)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
