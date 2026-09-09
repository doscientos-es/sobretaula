import type { FloorPlanTablePlacement, FloorPlanVersion } from '@/features/floor-plan'

import type { ServiceTableState, ServiceTableStatus } from '../domain/service-board'

const STATUS_FILL: Record<ServiceTableStatus, string> = {
  free: 'var(--muted-foreground)',
  occupied: 'var(--destructive)',
  reserved: 'var(--primary)',
}

/**
 * The plan is a picture, not the control: it is hidden from assistive tech and
 * every table is also reachable as a button in the list beside it.
 */
export function ServicePlan({
  onToggleTable,
  placements,
  selectedTableIds,
  states,
  version,
}: {
  onToggleTable: (tableId: string) => void
  placements: readonly FloorPlanTablePlacement[]
  selectedTableIds: readonly string[]
  states: readonly ServiceTableState[]
  version: FloorPlanVersion
}) {
  return (
    <svg
      aria-hidden="true"
      className="border-border bg-muted/30 h-auto w-full rounded-xl border shadow-inner"
      focusable="false"
      viewBox={`0 0 ${version.widthCm} ${version.heightCm}`}
    >
      {placements.map((placement) => {
        const state = states.find((candidate) => candidate.id === placement.id)
        const selected = selectedTableIds.includes(placement.id)

        return (
          <g key={placement.id}>
            <rect
              fill={STATUS_FILL[state?.status ?? 'free']}
              height={placement.heightCm}
              onClick={() => onToggleTable(placement.id)}
              opacity={selected ? 1 : 0.7}
              rx="12"
              stroke={selected ? 'var(--foreground)' : 'transparent'}
              strokeWidth="6"
              transform={`rotate(${placement.rotationDeg} ${placement.xCm} ${placement.yCm})`}
              width={placement.widthCm}
              x={placement.xCm}
              y={placement.yCm}
            />
            <text
              fill="var(--background)"
              fontSize="32"
              textAnchor="middle"
              x={placement.xCm + placement.widthCm / 2}
              y={placement.yCm + placement.heightCm / 2}
            >
              {placement.code}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
