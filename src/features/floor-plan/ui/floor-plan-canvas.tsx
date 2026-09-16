import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@doscientos/ui'
import { Settings2 } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'

import {
  type FloorPlanArea,
  type FloorPlanElement,
  type FloorPlanTablePlacement,
  type FloorPlanVersion,
  type PlanElementKind,
} from '../domain/floor-plan'
import type { LayoutIssue } from '../domain/geometry'
import type { FloorPlanPreviewDevice } from './floor-plan-setup-card'

const previewDeviceClasses: Record<FloorPlanPreviewDevice, string> = {
  desktop: 'max-w-none',
  mobile: 'max-w-[390px]',
  tablet: 'max-w-[768px]',
}

export function FloorPlanCanvas({
  activeArea: _activeArea,
  activeVersion,
  blockedAccesses,
  elements,
  gridSize,
  layoutIssues,
  onClearSelection,
  onEmptyPlace,
  onItemClick,
  onEditDimensions,
  onCreateTable,
  onDropElement,
  onMoveItem,
  onSelectItem,
  placements,
  previewDevice,
  selectedId,
  selectedIds,
}: {
  activeArea: FloorPlanArea | undefined
  activeVersion: FloorPlanVersion
  blockedAccesses: readonly { accessId: string; placementId: string }[]
  elements: readonly FloorPlanElement[]
  gridSize: number
  layoutIssues: readonly LayoutIssue[]
  onClearSelection: () => void
  onEmptyPlace: (xCm: number, yCm: number) => void
  onItemClick: (id: string) => void
  onEditDimensions: () => void
  onCreateTable: (position: { x: number; y: number }) => void
  onDropElement: (kind: PlanElementKind, xCm: number, yCm: number) => void
  onMoveItem: (id: string, xCm: number, yCm: number) => void
  onSelectItem: (id: string, additive?: boolean) => void
  placements: readonly FloorPlanTablePlacement[]
  previewDevice: FloorPlanPreviewDevice
  selectedId: string | undefined
  selectedIds: readonly string[]
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [draggingItemId, setDraggingItemId] = useState<string>()
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number }>()
  const [dropGhost, setDropGhost] = useState<{ kind: PlanElementKind; x: number; y: number }>()
  const panPointer = useRef<{ id: number; x: number; y: number } | undefined>(undefined)
  const dragOffset = useRef<{ x: number; y: number } | undefined>(undefined)
  const emptyPointer = useRef<{ id: number; x: number; y: number } | undefined>(undefined)
  const itemPointer = useRef<
    { id: string; pointerId: number; x: number; y: number; moved: boolean } | undefined
  >(undefined)
  const suppressClick = useRef(false)
  const viewBox = `${Math.max(0, Math.min(activeVersion.widthCm * (1 - 1 / zoom), (activeVersion.widthCm * (1 - 1 / zoom)) / 2 + pan.x)).toFixed(2)} ${Math.max(0, Math.min(activeVersion.heightCm * (1 - 1 / zoom), (activeVersion.heightCm * (1 - 1 / zoom)) / 2 + pan.y)).toFixed(2)} ${(activeVersion.widthCm / zoom).toFixed(2)} ${(activeVersion.heightCm / zoom).toFixed(2)}`
  const dragging = dragPreview
    ? (placements.find((item) => item.id === dragPreview.id) ??
      elements.find((item) => item.id === dragPreview.id))
    : undefined
  const dragGuides =
    dragging && dragPreview
      ? [
          { axis: 'x' as const, opacity: 0.22, value: dragPreview.x },
          { axis: 'x' as const, opacity: 0.7, value: dragPreview.x + dragging.widthCm / 2 },
          { axis: 'x' as const, opacity: 0.22, value: dragPreview.x + dragging.widthCm },
          { axis: 'y' as const, opacity: 0.22, value: dragPreview.y },
          { axis: 'y' as const, opacity: 0.7, value: dragPreview.y + dragging.heightCm / 2 },
          { axis: 'y' as const, opacity: 0.22, value: dragPreview.y + dragging.heightCm },
        ]
      : []

  function finishDrag(event: PointerEvent<SVGSVGElement>) {
    if (!draggingItemId) return
    const transform = event.currentTarget.getScreenCTM()
    if (!transform) {
      setDraggingItemId(undefined)
      return
    }
    const point = event.currentTarget.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const planPoint = point.matrixTransform(transform.inverse())
    const offset = dragOffset.current ?? { x: 0, y: 0 }
    onMoveItem(draggingItemId, planPoint.x - offset.x, planPoint.y - offset.y)
    setDraggingItemId(undefined)
    setDragPreview(undefined)
    dragOffset.current = undefined
  }

  function planPointFromEvent(event: {
    currentTarget: SVGSVGElement | SVGRectElement
    clientX: number
    clientY: number
  }) {
    const svg =
      event.currentTarget instanceof SVGSVGElement
        ? event.currentTarget
        : event.currentTarget.ownerSVGElement
    const transform = svg?.getScreenCTM()
    if (!transform) return undefined
    if (!svg) return undefined
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(transform.inverse())
  }

  return (
    <Card>
      <CardHeader className="relative">
        <CardTitle>{activeVersion.name}</CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CardDescription>
            {activeVersion.widthCm / 100} m × {activeVersion.heightCm / 100} m · {placements.length}{' '}
            mesas
          </CardDescription>
          <Button
            aria-label="Editar medidas del plano"
            className="size-7 px-0"
            onClick={onEditDimensions}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Settings2 className="size-3.5" />
          </Button>
        </div>
        <div
          className="flex items-center gap-1.5 pt-1 lg:absolute lg:top-5 lg:right-5 lg:pt-0"
          aria-label="Controles del plano"
        >
          <Button
            aria-label="Alejar plano"
            className="size-9 px-0"
            disabled={zoom <= 0.5}
            onClick={() => setZoom((current) => Math.max(0.5, current - 0.25))}
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
            aria-label="Restablecer zoom y posición"
            className="px-2 text-xs"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            type="button"
            variant="ghost"
          >
            Centrar
          </Button>
          <span className="text-muted-foreground ml-1 text-xs">Grid 25 cm</span>
        </div>
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
            className={cn(
            'w-full min-w-0 overflow-hidden',
            previewDeviceClasses[previewDevice],
          )}
        >
          <svg
            aria-hidden="true"
            className="border-border bg-background h-[clamp(300px,calc(100dvh-450px),720px)] w-full touch-none overscroll-contain rounded-lg border select-none"
            focusable="false"
            onWheelCapture={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const direction = event.deltaY > 0 ? 0.9 : 1.1
              setZoom((current) => Math.max(0.5, Math.min(3, current * direction)))
            }}
            onPointerDown={(event) => {
              if (event.button !== 1 && !event.altKey) return
              event.preventDefault()
              panPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (emptyPointer.current?.id === event.pointerId) {
                const moved = Math.hypot(
                  event.clientX - emptyPointer.current.x,
                  event.clientY - emptyPointer.current.y,
                )
                if (moved > 6) {
                  emptyPointer.current = undefined
                  suppressClick.current = true
                }
              }
              if (draggingItemId) {
                if (
                  itemPointer.current?.pointerId === event.pointerId &&
                  Math.hypot(
                    event.clientX - itemPointer.current.x,
                    event.clientY - itemPointer.current.y,
                  ) > 6
                )
                  itemPointer.current.moved = true
                suppressClick.current = true
                const point = planPointFromEvent(event)
                const offset = dragOffset.current ?? { x: 0, y: 0 }
                if (point) {
                  const rawX = point.x - offset.x
                  const rawY = point.y - offset.y
                  setDragPreview({
                    id: draggingItemId,
                    x: event.altKey ? rawX : Math.round(rawX / gridSize) * gridSize,
                    y: event.altKey ? rawY : Math.round(rawY / gridSize) * gridSize,
                  })
                }
                return
              }
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
              emptyPointer.current = undefined
              itemPointer.current = undefined
              setDraggingItemId(undefined)
              setDragPreview(undefined)
              dragOffset.current = undefined
            }}
            onPointerUp={(event) => {
              if (panPointer.current?.id === event.pointerId) {
                panPointer.current = undefined
                event.currentTarget.releasePointerCapture?.(event.pointerId)
              }
              finishDrag(event)
              itemPointer.current = undefined
              emptyPointer.current = undefined
            }}
            onDragOver={(event) => {
              event.preventDefault()
              const point = planPointFromEvent(event)
              const kind = event.dataTransfer.types.includes('application/x-floor-element')
                ? (event.dataTransfer.getData('application/x-floor-element') as PlanElementKind)
                : undefined
              if (point && kind) setDropGhost({ kind, x: point.x, y: point.y })
            }}
            onDragLeave={() => setDropGhost(undefined)}
            onDrop={(event) => {
              event.preventDefault()
              const point = planPointFromEvent(event)
              if (event.dataTransfer.types.includes('application/x-floor-table')) {
                if (point) onCreateTable(point)
                setDropGhost(undefined)
                return
              }
              const kind = event.dataTransfer.getData(
                'application/x-floor-element',
              ) as PlanElementKind
              if (point && kind) onDropElement(kind, point.x, point.y)
              setDropGhost(undefined)
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
              onPointerDown={(event) => {
                onClearSelection()
                emptyPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
              }}
              onClick={(event) => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                const point = planPointFromEvent(event)
                if (point) onEmptyPlace(point.x, point.y)
              }}
              width={activeVersion.widthCm}
            />
            <rect
              aria-hidden="true"
              fill="none"
              height={activeVersion.heightCm}
              pointerEvents="none"
              rx="4"
              stroke="var(--foreground)"
              strokeOpacity="0.7"
              strokeWidth="6"
              width={activeVersion.widthCm}
              x="0"
              y="0"
            />
            {dropGhost && (
              <rect
                aria-hidden="true"
                fill="var(--primary)"
                height={dropGhost.kind === 'wall' ? 25 : 100}
                opacity="0.35"
                pointerEvents="none"
                rx="8"
                width={dropGhost.kind === 'wall' ? 250 : 100}
                x={dropGhost.x}
                y={dropGhost.y}
              />
            )}
            {dragGuides.map((guide, index) =>
              guide.axis === 'x' ? (
                <line
                  key={`drag-guide-${index}`}
                  opacity={guide.opacity}
                  pointerEvents="none"
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
                  key={`drag-guide-${index}`}
                  opacity={guide.opacity}
                  pointerEvents="none"
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
              <g
                key={element.id}
                transform={
                  dragPreview?.id === element.id
                    ? `translate(${dragPreview.x - element.xCm} ${dragPreview.y - element.yCm})`
                    : undefined
                }
              >
                <rect
                  fill={element.kind === 'wall' ? 'var(--foreground)' : 'var(--muted-foreground)'}
                  height={element.heightCm}
                  onPointerDown={(event) =>
                    (() => {
                      onSelectItem(element.id, event.ctrlKey || event.metaKey)
                      itemPointer.current = {
                        id: element.id,
                        pointerId: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        moved: false,
                      }
                      const point = planPointFromEvent(event)
                      if (point)
                        dragOffset.current = {
                          x: point.x - element.xCm,
                          y: point.y - element.yCm,
                        }
                      setDraggingItemId(element.id)
                      event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
                    })()
                  }
                  onPointerUp={() => {
                    if (itemPointer.current?.id === element.id && !itemPointer.current.moved)
                      onItemClick(element.id)
                  }}
                  opacity={0.65}
                  rx="4"
                  stroke={selectedIds.includes(element.id) ? 'var(--ring)' : 'transparent'}
                  strokeWidth={selectedIds.includes(element.id) ? 4 : 0}
                  width={element.widthCm}
                  x={element.xCm}
                  y={element.yCm}
                />
                {element.label && (
                  <text pointerEvents="none" fontSize="20" x={element.xCm + 8} y={element.yCm + 28}>
                    {element.label}
                  </text>
                )}
                <g
                  aria-label={`Editar ${element.label ?? 'elemento'}`}
                  onClick={() => onItemClick(element.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                  role="button"
                  tabIndex={0}
                >
                  <circle cx={element.xCm + element.widthCm - 18} cy={element.yCm + element.heightCm - 18} fill="var(--background)" r="14" stroke="var(--border)" strokeWidth="2" />
                  <text fill="var(--foreground)" fontSize="16" pointerEvents="none" textAnchor="middle" x={element.xCm + element.widthCm - 18} y={element.yCm + element.heightCm - 13}>✎</text>
                </g>
              </g>
            ))}
            {placements.map((placement) => (
              <g
                key={placement.id}
                transform={
                  dragPreview?.id === placement.id
                    ? `translate(${dragPreview.x - placement.xCm} ${dragPreview.y - placement.yCm})`
                    : undefined
                }
              >
                <rect
                  fill={
                    layoutIssues.some((issue) => issue.placementId === placement.id)
                      ? 'var(--destructive)'
                      : 'var(--primary)'
                  }
                  height={placement.heightCm}
                  onPointerDown={(event) => {
                    onSelectItem(placement.id, event.ctrlKey || event.metaKey)
                    itemPointer.current = {
                      id: placement.id,
                      pointerId: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                      moved: false,
                    }
                    const point = planPointFromEvent(event)
                    if (point)
                      dragOffset.current = {
                        x: point.x - placement.xCm,
                        y: point.y - placement.yCm,
                      }
                    setDraggingItemId(placement.id)
                    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
                  }}
                  onPointerUp={() => {
                    if (itemPointer.current?.id === placement.id && !itemPointer.current.moved)
                      onItemClick(placement.id)
                  }}
                  opacity={0.85}
                  rx="12"
                  stroke={selectedIds.includes(placement.id) ? 'var(--ring)' : 'transparent'}
                  strokeWidth={selectedIds.includes(placement.id) ? 4 : 0}
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
                <g
                  aria-label={`Editar mesa ${placement.code}`}
                  onClick={() => onItemClick(placement.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                  role="button"
                  tabIndex={0}
                >
                  <circle cx={placement.xCm + placement.widthCm - 18} cy={placement.yCm + placement.heightCm - 18} fill="var(--background)" r="14" stroke="var(--border)" strokeWidth="2" />
                  <text fill="var(--foreground)" fontSize="16" pointerEvents="none" textAnchor="middle" x={placement.xCm + placement.widthCm - 18} y={placement.yCm + placement.heightCm - 13}>✎</text>
                </g>
              </g>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
