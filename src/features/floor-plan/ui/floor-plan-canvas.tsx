import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
} from '@doscientos/ui'
import { useRef, useState, type PointerEvent } from 'react'

import {
  type FloorPlanArea,
  type FloorPlanElement,
  type FloorPlanTablePlacement,
  type FloorPlanVersion,
} from '../domain/floor-plan'
import type { LayoutIssue } from '../domain/geometry'
import type { FloorPlanPreviewDevice } from './floor-plan-setup-card'

interface AlignmentGuide {
  axis: 'x' | 'y'
  value: number
}

export function FloorPlanCanvas({
  activeArea,
  activeVersion,
  alignmentGuides,
  blockedAccesses,
  elements,
  gridSize,
  layoutIssues,
  lockedIds,
  minimumAisleCm,
  onClearSelection,
  onGridSizeChange,
  onMinimumAisleChange,
  onMovePlacement,
  onSelectItem,
  placements,
  previewDevice,
  selectedId,
  selectedIds,
}: {
  activeArea: FloorPlanArea | undefined
  activeVersion: FloorPlanVersion
  alignmentGuides: readonly AlignmentGuide[]
  blockedAccesses: readonly { accessId: string; placementId: string }[]
  elements: readonly FloorPlanElement[]
  gridSize: number
  layoutIssues: readonly LayoutIssue[]
  lockedIds: readonly string[]
  minimumAisleCm: number
  onClearSelection: () => void
  onGridSizeChange: (value: number) => void
  onMinimumAisleChange: (value: number) => void
  onMovePlacement: (id: string, xCm: number, yCm: number) => void
  onSelectItem: (id: string, additive?: boolean) => void
  placements: readonly FloorPlanTablePlacement[]
  previewDevice: FloorPlanPreviewDevice
  selectedId: string | undefined
  selectedIds: readonly string[]
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [draggingTableId, setDraggingTableId] = useState<string>()
  const panPointer = useRef<{ id: number; x: number; y: number } | undefined>(undefined)
  const viewBox = `${Math.max(0, Math.min(activeVersion.widthCm * (1 - 1 / zoom), (activeVersion.widthCm * (1 - 1 / zoom)) / 2 + pan.x)).toFixed(2)} ${Math.max(0, Math.min(activeVersion.heightCm * (1 - 1 / zoom), (activeVersion.heightCm * (1 - 1 / zoom)) / 2 + pan.y)).toFixed(2)} ${(activeVersion.widthCm / zoom).toFixed(2)} ${(activeVersion.heightCm / zoom).toFixed(2)}`

  function finishDrag(event: PointerEvent<SVGSVGElement>) {
    if (!draggingTableId) return
    const transform = event.currentTarget.getScreenCTM()
    if (!transform) {
      setDraggingTableId(undefined)
      return
    }
    const point = event.currentTarget.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const planPoint = point.matrixTransform(transform.inverse())
    onMovePlacement(draggingTableId, planPoint.x, planPoint.y)
    setDraggingTableId(undefined)
  }

  const selected =
    placements.find((item) => item.id === selectedId) ??
    elements.find((item) => item.id === selectedId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{activeVersion.name}</CardTitle>
        <CardDescription>
          {activeVersion.widthCm / 100} m × {activeVersion.heightCm / 100} m · {placements.length}{' '}
          mesas
        </CardDescription>
        <div className="flex flex-wrap items-center gap-1.5 pt-1" aria-label="Controles del plano">
          <Button
            aria-label="Alejar plano"
            className="size-9 px-0"
            disabled={zoom <= 1}
            onClick={() => setZoom((current) => Math.max(1, current - 0.25))}
            type="button"
            variant="outline"
          >
            −
          </Button>
          <output className="text-muted-foreground min-w-14 text-center text-sm tabular-nums">
            {Math.round(zoom * 100)}%
          </output>
          <Button
            aria-label="Acercar plano"
            className="size-9 px-0"
            disabled={zoom >= 3}
            onClick={() => setZoom((current) => Math.min(3, current + 0.25))}
            type="button"
            variant="outline"
          >
            +
          </Button>
          <Button
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            type="button"
            variant="ghost"
          >
            Restablecer
          </Button>
          <label className="text-muted-foreground ml-2 flex items-center gap-2 text-sm">
            Cuadrícula
            <select
              aria-label="Tamaño de cuadrícula"
              className="border-border rounded-md border px-2 py-1"
              onChange={(event) => onGridSizeChange(Number(event.target.value))}
              value={gridSize}
            >
              <option value={25}>25 cm</option>
              <option value={50}>50 cm</option>
              <option value={100}>1 m</option>
            </select>
          </label>
          <label className="text-muted-foreground ml-2 flex items-center gap-2 text-sm">
            Pasillo mínimo
            <select
              aria-label="Anchura mínima de pasillo"
              className="border-border rounded-md border px-2 py-1"
              onChange={(event) => onMinimumAisleChange(Number(event.target.value))}
              value={minimumAisleCm}
            >
              <option value={0}>Sin validar</option>
              <option value={75}>75 cm</option>
              <option value={90}>90 cm</option>
              <option value={120}>1,2 m</option>
            </select>
          </label>
        </div>
        {alignmentGuides.length > 0 && (
          <p aria-live="polite" className="text-muted-foreground pt-2 text-xs">
            Ajuste automático activo:{' '}
            {alignmentGuides.some((guide) => guide.axis === 'x') ? 'alineación vertical' : ''}
            {alignmentGuides.some((guide) => guide.axis === 'x') &&
            alignmentGuides.some((guide) => guide.axis === 'y')
              ? ' y '
              : ''}
            {alignmentGuides.some((guide) => guide.axis === 'y') ? 'alineación horizontal' : ''}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {layoutIssues.length > 0 && (
          <div
            className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-lg border p-3 text-sm"
            role="alert"
          >
            <p className="font-medium">Hay problemas que impiden publicar este plano</p>
            <ul className="mt-1 list-inside list-disc">
              {layoutIssues.map((issue) => (
                <li key={`${issue.code}-${issue.placementId}-${issue.relatedPlacementId ?? ''}`}>
                  {issue.code === 'overlap'
                    ? `Solape entre ${issue.placementId} y ${issue.relatedPlacementId}`
                    : issue.code === 'narrow_passage'
                      ? `Pasillo demasiado estrecho entre ${issue.placementId} y ${issue.relatedPlacementId}`
                      : issue.code === 'outside_bounds'
                        ? `${issue.placementId} queda fuera del plano`
                        : `${issue.placementId} tiene un tamaño inválido`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {blockedAccesses.length > 0 && (
          <div
            className="border-warning/40 bg-warning/10 text-warning-foreground mb-4 rounded-lg border p-3 text-sm"
            role="alert"
          >
            <p className="font-medium">Hay accesos bloqueados</p>
            <ul className="mt-1 list-inside list-disc">
              {blockedAccesses.map((issue) => (
                <li key={`${issue.accessId}-${issue.placementId}`}>
                  Una mesa bloquea una puerta o salida.
                </li>
              ))}
            </ul>
          </div>
        )}
        <div
          className={`mx-auto transition-[max-width] ${previewDevice === 'mobile' ? 'max-w-[390px]' : previewDevice === 'tablet' ? 'max-w-[768px]' : 'max-w-none'}`}
        >
          <svg
            aria-hidden="true"
            className="border-border bg-background h-auto w-full rounded-lg border"
            focusable="false"
            onPointerDown={(event) => {
              if (event.button !== 1 && !event.altKey) return
              event.preventDefault()
              panPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const start = panPointer.current
              if (!start || start.id !== event.pointerId) return
              const bounds = event.currentTarget.getBoundingClientRect()
              setPan((current) => ({
                x:
                  current.x -
                  ((event.clientX - start.x) / bounds.width) * (activeVersion.widthCm / zoom),
                y:
                  current.y -
                  ((event.clientY - start.y) / bounds.height) * (activeVersion.heightCm / zoom),
              }))
              panPointer.current = { ...start, x: event.clientX, y: event.clientY }
            }}
            onPointerCancel={() => {
              panPointer.current = undefined
              setDraggingTableId(undefined)
            }}
            onPointerUp={(event) => {
              if (panPointer.current?.id === event.pointerId) {
                panPointer.current = undefined
                event.currentTarget.releasePointerCapture?.(event.pointerId)
              }
              finishDrag(event)
            }}
            onWheel={(event) => {
              event.preventDefault()
              setZoom((current) =>
                Math.min(3, Math.max(1, current + (event.deltaY < 0 ? 0.25 : -0.25))),
              )
            }}
            viewBox={viewBox}
          >
            <defs>
              <pattern
                height={gridSize}
                id="floor-plan-grid"
                patternUnits="userSpaceOnUse"
                width={gridSize}
              >
                <path
                  d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="2"
                />
              </pattern>
            </defs>
            <rect
              fill="url(#floor-plan-grid)"
              height={activeVersion.heightCm}
              onPointerDown={onClearSelection}
              width={activeVersion.widthCm}
            />
            {selected && (
              <g
                aria-hidden="true"
                pointerEvents="none"
                stroke="var(--ring)"
                strokeDasharray="12 10"
                opacity="0.45"
                strokeWidth="1.5"
              >
                <line
                  x1={selected.xCm + selected.widthCm / 2}
                  x2={selected.xCm + selected.widthCm / 2}
                  y1={0}
                  y2={activeVersion.heightCm}
                />
                <line
                  x1={0}
                  x2={activeVersion.widthCm}
                  y1={selected.yCm + selected.heightCm / 2}
                  y2={selected.yCm + selected.heightCm / 2}
                />
              </g>
            )}
            {alignmentGuides.map((guide, index) =>
              guide.axis === 'x' ? (
                <line
                  key={`guide-${index}`}
                  opacity="0.65"
                  stroke="var(--primary)"
                  strokeDasharray="8 8"
                  strokeWidth="1.5"
                  x1={guide.value}
                  x2={guide.value}
                  y1={0}
                  y2={activeVersion.heightCm}
                />
              ) : (
                <line
                  key={`guide-${index}`}
                  opacity="0.65"
                  stroke="var(--primary)"
                  strokeDasharray="8 8"
                  strokeWidth="1.5"
                  x1={0}
                  x2={activeVersion.widthCm}
                  y1={guide.value}
                  y2={guide.value}
                />
              ),
            )}
            {elements.map((element) => (
              <g key={element.id}>
                <rect
                  fill={element.kind === 'wall' ? 'var(--foreground)' : 'var(--muted-foreground)'}
                  height={element.heightCm}
                  onPointerDown={(event) =>
                    onSelectItem(element.id, event.ctrlKey || event.metaKey)
                  }
                  opacity={lockedIds.includes(element.id) ? 0.48 : 0.65}
                  rx="4"
                  stroke={selectedIds.includes(element.id) ? 'var(--ring)' : 'transparent'}
                  strokeWidth={selectedIds.includes(element.id) ? 4 : 0}
                  transform={`rotate(${element.rotationDeg} ${element.xCm + element.widthCm / 2} ${element.yCm + element.heightCm / 2})`}
                  width={element.widthCm}
                  x={element.xCm}
                  y={element.yCm}
                />
                {element.label && (
                  <text pointerEvents="none" fontSize="20" x={element.xCm + 8} y={element.yCm + 28}>
                    {element.label}
                  </text>
                )}
              </g>
            ))}
            {placements.map((placement) => (
              <g key={placement.id}>
                <rect
                  fill={
                    layoutIssues.some((issue) => issue.placementId === placement.id)
                      ? 'var(--destructive)'
                      : 'var(--primary)'
                  }
                  height={placement.heightCm}
                  onPointerDown={(event) => {
                    onSelectItem(placement.id, event.ctrlKey || event.metaKey)
                    if (!lockedIds.includes(placement.id)) {
                      setDraggingTableId(placement.id)
                    }
                  }}
                  opacity={lockedIds.includes(placement.id) ? 0.62 : 0.85}
                  rx="12"
                  stroke={selectedIds.includes(placement.id) ? 'var(--ring)' : 'transparent'}
                  strokeWidth={selectedIds.includes(placement.id) ? 4 : 0}
                  transform={`rotate(${placement.rotationDeg} ${placement.xCm + placement.widthCm / 2} ${placement.yCm + placement.heightCm / 2})`}
                  width={placement.widthCm}
                  x={placement.xCm}
                  y={placement.yCm}
                />
                <text
                  fill="var(--primary-foreground)"
                  fontSize="32"
                  pointerEvents="none"
                  textAnchor="middle"
                  x={placement.xCm + placement.widthCm / 2}
                  y={placement.yCm + placement.heightCm / 2}
                >
                  {placement.code}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
