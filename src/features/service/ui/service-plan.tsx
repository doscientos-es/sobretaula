import type { FloorPlanTablePlacement, FloorPlanVersion } from '@/features/floor-plan'

import type { ServiceTableState, ServiceTableStatus } from '../domain/service-board'

const STATUS_FILL: Record<ServiceTableStatus, string> = {
  blocked: 'fill-muted-foreground/40',
  cleaning: 'fill-amber-500/70',
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
    <div>
      <svg
        aria-label="Plano de mesas interactivo"
        role="group"
        className="border-border bg-background h-auto w-full rounded-lg border"
        focusable="false"
        viewBox={`0 0 ${version.widthCm} ${version.heightCm}`}
      >
        {placements.map((placement) => {
          const state = states.find((candidate) => candidate.id === placement.id)
          const selected = selectedTableIds.includes(placement.id)

          return (
            <g
              aria-label={`Mesa ${placement.code}`}
              key={placement.id}
              onClick={() => onToggleTable(placement.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onToggleTable(placement.id)
                }
              }}
              role="button"
              style={{ cursor: 'pointer' }}
              tabIndex={0}
            >
              <rect
                fill={STATUS_FILL[state?.status ?? 'free']}
                height={placement.heightCm}
                opacity={selected ? 1 : 0.7}
                rx="12"
                stroke={selected ? 'var(--foreground)' : 'transparent'}
                strokeWidth="4"
                width={placement.widthCm}
                x={placement.xCm}
                y={placement.yCm}
              />
              <text
                fill="var(--background)"
                fontSize="32"
                onClick={() => onToggleTable(placement.id)}
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
      <div aria-label="Mesas del plano" className="mt-3 grid gap-2 sm:grid-cols-2">
        {placements.map((placement) => {
          const state = states.find((candidate) => candidate.id === placement.id)
          return (
            <button
              aria-pressed={selectedTableIds.includes(placement.id)}
              className="border-border rounded-md border px-3 py-2 text-left text-sm"
              key={`list-${placement.id}`}
              onClick={() => onToggleTable(placement.id)}
              type="button"
            >
              Mesa {placement.code} ·{' '}
              {state?.status === 'free' ? 'Libre' : (state?.status ?? 'Libre')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
