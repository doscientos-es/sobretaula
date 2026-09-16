import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import { useQueryClient } from '@tanstack/react-query'
import {
  Armchair,
  Bath,
  DoorOpen,
  Footprints,
  PanelTop,
  Soup,
  Square,
  Table2,
} from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent, type DragEvent } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  createFloorPlanTable,
  createInitialFloorPlan,
  saveFloorPlanVersion,
} from '../application/floor-plan'
import {
  commitEditorHistory,
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
} from '../domain/editor-history'
import {
  selectFloorPlanVersion,
  type FloorPlanData,
  type FloorPlanElement,
  type PlanElementKind,
} from '../domain/floor-plan'
import {
  DEFAULT_GRID_SIZE_CM,
  findPlacementCollisions,
  findBlockedAccesses,
  findNarrowPassages,
  isPlacementWithinBounds,
  movePlacement,
  validateLayout,
} from '../domain/geometry'

const elementDefaults: Record<PlanElementKind, { widthCm: number; heightCm: number }> = {
  wall: { widthCm: 250, heightCm: 25 }, door: { widthCm: 100, heightCm: 100 },
  window: { widthCm: 150, heightCm: 20 }, bar: { widthCm: 250, heightCm: 100 },
  stairs: { widthCm: 150, heightCm: 250 }, plant: { widthCm: 60, heightCm: 60 },
  label: { widthCm: 100, heightCm: 40 }, other: { widthCm: 100, heightCm: 100 },
  pillar: { widthCm: 40, heightCm: 40 }, bathroom: { widthCm: 200, heightCm: 200 },
  kitchen: { widthCm: 300, heightCm: 200 }, exit: { widthCm: 100, heightCm: 100 },
  obstacle: { widthCm: 100, heightCm: 100 },
}
import { FloorPlanCanvas } from './floor-plan-canvas'
import type { FloorPlanPreviewDevice } from './floor-plan-setup-card'

export function FloorPlanPage({
  data,
  tenantId,
  venueId,
}: {
  data: FloorPlanData
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const reload = useLoaderReload()
  const queryClient = useQueryClient()
  const [tableCode, setTableCode] = useState('1')
  const [tableSeats, setTableSeats] = useState(4)
  const [tableAccessible, setTableAccessible] = useState(false)
  const [tableXCm, setTableXCm] = useState(50)
  const [tableYCm, setTableYCm] = useState(50)
  const [previewDevice] = useState<FloorPlanPreviewDevice>('desktop')
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE_CM)
  const [minimumAisleCm, setMinimumAisleCm] = useState(90)
  const [selectedAreaId, setSelectedAreaId] = useState(data.areas[0]?.id)
  const [initializing, setInitializing] = useState(false)
  const [initializationFailed, setInitializationFailed] = useState(false)
  const [createAreaOpen, setCreateAreaOpen] = useState(false)
  const [newAreaName, setNewAreaName] = useState('Terraza')
  const [creatingArea, setCreatingArea] = useState(false)
  const [addElementAt, setAddElementAt] = useState<{ x: number; y: number }>()
  function reloadFloorPlan() {
    void queryClient.invalidateQueries({
      queryKey: ['tenant', tenantId, 'venue', venueId, 'floor-plan'],
    })
    reload()
  }
  const activeArea = data.areas.find((area) => area.id === selectedAreaId) ?? data.areas[0]
  const activeVersion = activeArea
    ? (selectFloorPlanVersion(data.versions, activeArea.id) ??
      data.versions.find((version) => version.areaId === activeArea.id))
    : undefined
  useAsyncEffect(() => {
    if (data.areas.length > 0 || initializing || initializationFailed) return
    setInitializing(true)
    feedback.setPending()
    void createInitialFloorPlan({
      data: {
        areaName: 'Sala principal',
        floorNumber: 0,
        heightCm: 600,
        outdoorOpen: true,
        spaceType: 'indoor',
        tenantId,
        venueId,
        widthCm: 800,
      },
    })
      .then(() => {
        reloadFloorPlan()
        feedback.setSuccess('Plano inicial preparado.')
      })
      .catch(() => {
        setInitializationFailed(true)
        feedback.setError('No se ha podido preparar el plano inicial.')
      })
      .finally(() => setInitializing(false))
  }, [
    data.areas.length,
    feedback,
    initializationFailed,
    initializing,
    reloadFloorPlan,
    tenantId,
    venueId,
  ])
  const savedPlacements = activeVersion
    ? data.placements.filter((placement) => placement.floorPlanVersionId === activeVersion.id)
    : []
  const savedElements = activeVersion
    ? data.elements.filter((element) => element.floorPlanVersionId === activeVersion.id)
    : []
  const [history, setHistory] = useState(() =>
    createEditorHistory({
      elements: savedElements,
      placements: savedPlacements,
    }),
  )
  const { elements, placements } = history.present
  function selectItem(id: string, additive = false) {
    setSelectedId(id)
    setSelectedIds((current) =>
      additive
        ? current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
        : [id],
    )
  }
  const layoutIssues = activeVersion
    ? [
        ...validateLayout(placements, activeVersion),
        ...findNarrowPassages(placements, minimumAisleCm).map((passage) => ({
          code: 'narrow_passage' as const,
          placementId: passage.firstPlacementId,
          relatedPlacementId: passage.secondPlacementId,
        })),
      ]
    : []
  const blockedAccesses = findBlockedAccesses(placements, elements)
  const selectedPlacement = placements.find((item) => item.id === selectedId)
  const alignmentGuides = selectedPlacement
    ? placements
        .filter((item) => item.id !== selectedPlacement.id)
        .flatMap((item) => {
          const guides: Array<{ axis: 'x' | 'y'; value: number }> = []
          const selectedX = [
            selectedPlacement.xCm,
            selectedPlacement.xCm + selectedPlacement.widthCm / 2,
            selectedPlacement.xCm + selectedPlacement.widthCm,
          ]
          const selectedY = [
            selectedPlacement.yCm,
            selectedPlacement.yCm + selectedPlacement.heightCm / 2,
            selectedPlacement.yCm + selectedPlacement.heightCm,
          ]
          const otherX = [item.xCm, item.xCm + item.widthCm / 2, item.xCm + item.widthCm]
          const otherY = [item.yCm, item.yCm + item.heightCm / 2, item.yCm + item.heightCm]
          const xMatch = otherX.find((candidate) =>
            selectedX.some((value) => Math.abs(value - candidate) <= gridSize / 2),
          )
          const yMatch = otherY.find((candidate) =>
            selectedY.some((value) => Math.abs(value - candidate) <= gridSize / 2),
          )
          if (xMatch !== undefined) guides.push({ axis: 'x', value: xMatch })
          if (yMatch !== undefined) guides.push({ axis: 'y', value: yMatch })
          return guides
        })
    : []
  async function createArea() {
    const areaName = newAreaName.trim()
    if (!areaName) return
    setCreatingArea(true)
    feedback.setPending()
    try {
      await createInitialFloorPlan({
        data: {
          areaName,
          floorNumber: null,
          heightCm: 600,
          outdoorOpen: true,
          spaceType: areaName.toLocaleLowerCase().includes('terraza')
            ? 'outdoor_terrace'
            : 'indoor',
          tenantId,
          venueId,
          widthCm: 800,
        },
      })
      feedback.setSuccess(`${areaName} preparada.`)
      setCreateAreaOpen(false)
      setNewAreaName('Terraza')
      reloadFloorPlan()
    } catch {
      feedback.setError('No se ha podido crear la nueva zona.')
    } finally {
      setCreatingArea(false)
    }
  }

  function moveItem(id: string, xCm: number, yCm: number) {
    if (placements.some((item) => item.id === id)) {
      changePlacement(id, xCm, yCm)
      return
    }
    const element = elements.find((item) => item.id === id)
    if (!element || !activeVersion) return
    const next = {
      ...element,
      xCm: Math.round(xCm / gridSize) * gridSize,
      yCm: Math.round(yCm / gridSize) * gridSize,
    }
    if (!isPlacementWithinBounds(next, activeVersion)) return
    setHistory((current) =>
      commitEditorHistory(current, {
        ...current.present,
        elements: current.present.elements.map((item) => (item.id === id ? next : item)),
      }),
    )
  }

  async function createTable(
    event?: FormEvent<HTMLFormElement>,
    position?: { x: number; y: number },
    code = tableCode,
  ) {
    event?.preventDefault()
    if (!activeArea || !activeVersion) return
    feedback.setPending()

    try {
      await createFloorPlanTable({
        data: {
          areaId: activeArea.id,
          code,
          heightCm: 100,
          maxSeats: tableSeats,
          minSeats: 1,
          isAccessible: tableAccessible,
          tenantId,
          venueId,
          versionId: activeVersion.id,
          widthCm: 100,
          xCm: position?.x ?? tableXCm,
          yCm: position?.y ?? tableYCm,
        },
      })
      feedback.setSuccess('Mesa añadida.')
      reloadFloorPlan()
    } catch {
      feedback.setError('La mesa queda fuera del plano, se solapa o ya existe ese código.')
    }
  }

  function createQuickTable(position: { x: number; y: number }) {
    const usedCodes = new Set(placements.map((placement) => placement.code))
    let number = 1
    while (usedCodes.has(`M${number}`)) number += 1
    void createTable(undefined, position, `M${number}`)
  }

  function changePlacement(id: string, xCm: number, yCm: number) {
    if (!activeVersion) return
    const moving = placements.find((placement) => placement.id === id)
    if (!moving) return
    const others = placements.filter((placement) => placement.id !== id)
    const snap = (value: number, candidates: number[]) =>
      candidates.reduce(
        (best, candidate) =>
          Math.abs(value - candidate) <= gridSize / 2 &&
          Math.abs(value - candidate) < Math.abs(value - best)
            ? candidate
            : best,
        value,
      )
    const xCandidates = others.flatMap((item) => [
      item.xCm,
      item.xCm + item.widthCm / 2 - moving.widthCm / 2,
      item.xCm + item.widthCm - moving.widthCm,
    ])
    const yCandidates = others.flatMap((item) => [
      item.yCm,
      item.yCm + item.heightCm / 2 - moving.heightCm / 2,
      item.yCm + item.heightCm - moving.heightCm,
    ])
    const snappedX = snap(xCm, xCandidates)
    const snappedY = snap(yCm, yCandidates)
    const updated = placements.map((placement) => {
      if (placement.id !== id) return placement
      return {
        ...placement,
        ...movePlacement(placement, { xCm: snappedX, yCm: snappedY }, gridSize),
      }
    })
    const candidate = updated.find((placement) => placement.id === id)
    if (
      !candidate ||
      !isPlacementWithinBounds(candidate, activeVersion) ||
      findPlacementCollisions(candidate, updated).length > 0
    ) {
      feedback.setError('Ese movimiento deja la mesa fuera del plano o solapada.')
      return
    }
    setHistory((current) =>
      commitEditorHistory(current, { ...current.present, placements: updated }),
    )
  }

  function switchArea(areaId: string) {
    const version =
      selectFloorPlanVersion(data.versions, areaId) ??
      data.versions.find((candidate) => candidate.areaId === areaId)
    setSelectedAreaId(areaId)
    setSelectedId(undefined)
    setSelectedIds([])
    setHistory(
      createEditorHistory({
        elements: data.elements.filter((element) => element.floorPlanVersionId === version?.id),
        placements: data.placements.filter(
          (placement) => placement.floorPlanVersionId === version?.id,
        ),
      }),
    )
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const distance = event.shiftKey ? 5 : gridSize
    const current = placements.find((placement) => placement.id === id)
    const currentElement = elements.find((element) => element.id === id)
    const movable = current ?? currentElement
    if (!movable) return
    const displacement = {
      ArrowDown: { x: 0, y: distance },
      ArrowLeft: { x: -distance, y: 0 },
      ArrowRight: { x: distance, y: 0 },
      ArrowUp: { x: 0, y: -distance },
    }[event.key]
    if (!displacement) return
    event.preventDefault()
    if (current) changePlacement(id, current.xCm + displacement.x, current.yCm + displacement.y)
    else
      updateSelected({
        xCm: movable.xCm + displacement.x,
        yCm: movable.yCm + displacement.y,
      })
  }

  function addElement(kind: PlanElementKind, position = { x: 0, y: 0 }) {
    if (!activeVersion) return
    const element: FloorPlanElement = {
      floorPlanVersionId: activeVersion.id,
      heightCm: elementDefaults[kind].heightCm,
      id: crypto.randomUUID(),
      kind,
      label:
        kind === 'wall'
          ? 'Pared'
          : kind === 'door'
            ? 'Puerta'
            : kind === 'bar'
              ? 'Barra'
              : kind === 'stairs'
                ? 'Escalera'
                : kind === 'plant'
                  ? 'Planta'
                  : kind === 'window'
                    ? 'Ventana'
                    : kind === 'other'
                      ? 'Obstáculo'
                      : kind === 'pillar'
                        ? 'Pilar'
                        : kind === 'bathroom'
                          ? 'Baño'
                          : kind === 'kitchen'
                            ? 'Cocina'
                            : kind === 'exit'
                              ? 'Salida'
                              : 'Etiqueta',
      widthCm: elementDefaults[kind].widthCm,
      xCm: Math.max(0, Math.round(position.x / gridSize) * gridSize),
      yCm: Math.max(0, Math.round(position.y / gridSize) * gridSize),
    }
    setHistory((current) =>
      commitEditorHistory(current, {
        ...current.present,
        elements: [...elements, element],
      }),
    )
  }

  function removeSelected() {
    if (!selectedId) return
    const ids = selectedIds.length > 0 ? selectedIds : [selectedId]
    setHistory((current) =>
      commitEditorHistory(current, {
        elements: elements.filter((item) => !ids.includes(item.id)),
        placements: placements.filter((item) => !ids.includes(item.id)),
      }),
    )
    setSelectedId(undefined)
    setSelectedIds([])
  }

  function updateSelected(
    values: Partial<Pick<FloorPlanElement, 'heightCm' | 'label' | 'widthCm' | 'xCm' | 'yCm'>>,
  ) {
    if (!selectedId || !activeVersion) return
    const selectedTable = placements.find((item) => item.id === selectedId)
    const selectedElement = elements.find((item) => item.id === selectedId)
    const selected = selectedTable ?? selectedElement
    if (!selected) return
    const candidate = { ...selected, ...values }
    if (candidate.widthCm <= 0 || candidate.heightCm <= 0) {
      feedback.setError('El tamaño debe ser positivo.')
      return
    }
    if (!isPlacementWithinBounds(candidate, activeVersion)) {
      feedback.setError('El elemento debe quedar completamente dentro del plano.')
      return
    }
    if (
      selectedTable &&
      findPlacementCollisions(
        candidate,
        placements.filter((item) => item.id !== selectedId),
      ).length > 0
    ) {
      feedback.setError('La mesa se solapa con otra mesa.')
      return
    }
    const nextElements = elements.map((item) =>
      item.id === selectedId ? { ...item, ...values } : item,
    )
    const nextPlacements = placements.map((item) =>
      item.id === selectedId ? { ...item, ...values } : item,
    )
    setHistory((current) =>
      commitEditorHistory(current, {
        elements: nextElements,
        placements: nextPlacements,
      }),
    )
  }

  async function savePlan() {
    if (!activeVersion) return
    if (layoutIssues.length > 0) {
      feedback.setError('Corrige los problemas del plano antes de publicarlo.')
      return
    }
    feedback.setPending()
    try {
      await saveFloorPlanVersion({
        data: {
          activeFrom: new Date().toISOString(),
          activeTo: null,
          elements,
          name: 'Plano',
          placements,
          sourceVersionId: activeVersion.id,
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Plano guardado.')
      reloadFloorPlan()
    } catch {
      feedback.setError('No se ha podido guardar el plano.')
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Plano de sala</PageHeaderTitle>
          <PageHeaderDescription>
            Coloca las mesas y algunos puntos de referencia para orientarte durante el servicio.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      {initializationFailed ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-destructive text-sm" role="alert">
              No se ha podido preparar el plano inicial.
            </p>
            <Button
              onClick={() => {
                setInitializationFailed(false)
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {!activeVersion ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-48 items-center justify-center text-center">
            <p className="text-muted-foreground text-sm">
              Preparando un espacio estándar de restaurante para que puedas editarlo…
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div
            className="flex items-center gap-2 overflow-x-auto lg:col-span-2"
            role="tablist"
            aria-label="Plantas y zonas"
          >
            {data.areas.map((area) => (
              <Button
                key={area.id}
                aria-selected={area.id === activeArea?.id}
                onClick={() => switchArea(area.id)}
                type="button"
                variant={area.id === activeArea?.id ? 'default' : 'outline'}
              >
                {area.name}
              </Button>
            ))}
            <Button onClick={() => setCreateAreaOpen(true)} type="button" variant="outline">
              + Añadir planta o zona
            </Button>
          </div>
          <FloorPlanCanvas
            activeArea={activeArea}
            activeVersion={activeVersion}
            alignmentGuides={alignmentGuides}
            blockedAccesses={blockedAccesses}
            elements={elements}
            gridSize={gridSize}
            layoutIssues={layoutIssues}
            minimumAisleCm={minimumAisleCm}
            onClearSelection={() => {
              setSelectedId(undefined)
              setSelectedIds([])
            }}
            onEmptyPlace={(x, y) => setAddElementAt({ x, y })}
            onCreateTable={createQuickTable}
            onDropElement={(kind, x, y) => addElement(kind, { x, y })}
            onGridSizeChange={setGridSize}
            onMinimumAisleChange={setMinimumAisleCm}
            onMoveItem={moveItem}
            onSelectItem={selectItem}
            placements={placements}
            previewDevice={previewDevice}
            selectedId={selectedId}
            selectedIds={selectedIds}
          />
          <Card className="lg:sticky lg:top-6 lg:self-start">
            <CardHeader>
              <CardTitle>Mesas y elementos</CardTitle>
              <CardDescription>Arrastra una mesa al plano o selecciona algo para editarlo.</CardDescription>
            </CardHeader>
            <CardContent>
              {placements.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aún no hay mesas en esta área.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {placements.map((placement) => (
                    <li key={placement.id}>
                      <Button
                        aria-label={`Mesa ${placement.code}. X ${placement.xCm}, Y ${placement.yCm}. Usa las flechas para moverla.`}
                        onKeyDown={(event) => moveWithKeyboard(event, placement.id)}
                        onFocus={() => selectItem(placement.id)}
                        type="button"
                      >
                        {`Mesa ${placement.code} · ${placement.xCm}, ${placement.yCm}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedId && (
                <output className="bg-muted mt-3 block rounded-lg px-3 py-2 text-xs">
                  {selectedIds.length > 1
                    ? `${selectedIds.length} elementos seleccionados · `
                    : 'Seleccionado: '}
                  {placements.find((item) => item.id === selectedId)?.code ?? 'elemento'} · usa las
                  flechas para ajustar. Pulsa R para girar y mantén Ctrl/Cmd para seleccionar varios.
                </output>
              )}
              {selectedId && (
                <div className="mt-3 flex gap-2">
                  <Button onClick={removeSelected} type="button">
                    Eliminar
                  </Button>
                </div>
              )}
              {selectedId &&
                (() => {
                  const selected =
                    placements.find((item) => item.id === selectedId) ??
                    elements.find((item) => item.id === selectedId)
                  if (!selected) return null
                  return (
                    <div className="border-border mt-4 space-y-3 rounded-lg border p-3">
                      <p className="text-sm font-medium">Propiedades</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['xCm', 'yCm', 'widthCm', 'heightCm'] as const).map((key) => (
                          <Field key={key}>
                            <FieldLabel htmlFor={`selected-${key}`}>
                              {key.replace('Cm', ' (cm)')}
                            </FieldLabel>
                            <Input
                              id={`selected-${key}`}
                              min={0}
                              onChange={(event) =>
                                updateSelected({
                                  [key]: Number(event.target.value),
                                })
                              }
                              placeholder="0"
                              type="number"
                              value={selected[key]}
                            />
                          </Field>
                        ))}
                      </div>
                      {'label' in selected && (
                        <Field>
                          <FieldLabel htmlFor="selected-label">Etiqueta</FieldLabel>
                          <Input
                            id="selected-label"
                            onChange={(event) => updateSelected({ label: event.target.value })}
                            placeholder="Ej. Barra o puerta"
                            value={selected.label ?? ''}
                          />
                        </Field>
                      )}
                    </div>
                  )
                })()}
              <div className="mt-6 space-y-2">
                <p className="text-muted-foreground text-sm">Elementos estructurales</p>
                <div
                  draggable
                  onDragStart={(event: DragEvent<HTMLDivElement>) =>
                    event.dataTransfer.setData('application/x-floor-table', 'table')
                  }
                >
                  <Button
                    className="border-primary h-auto w-full justify-start gap-2 py-3"
                    onClick={() => createQuickTable({ x: 50, y: 50 })}
                    type="button"
                    variant="outline"
                  >
                    <Table2 className="size-4" /> Añadir mesa al plano
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['wall', 'Pared', Square],
                      ['door', 'Puerta', DoorOpen],
                      ['bar', 'Barra', PanelTop],
                      ['stairs', 'Escalera', Footprints],
                      ['plant', 'Planta', Armchair],
                      ['bathroom', 'Baño', Bath],
                      ['kitchen', 'Cocina', Soup],
                    ] as const
                  ).map(([kind, label, Icon]) => (
                    <div
                      draggable
                      onDragStart={(event: DragEvent<HTMLDivElement>) =>
                        event.dataTransfer.setData('application/x-floor-element', kind)
                      }
                      key={kind}
                    >
                      <Button
                        className="h-auto w-full justify-start gap-2 py-3"
                        onClick={() => addElement(kind)}
                        type="button"
                        variant="outline"
                      >
                        <Icon className="size-4" /> {label}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              {activeArea && (
                <form className="mt-6 grid gap-3" onSubmit={(event) => void createTable(event)}>
                  <Field>
                    <FieldLabel htmlFor="table-code">Código</FieldLabel>
                    <Input
                      id="table-code"
                      onChange={(event) => setTableCode(event.target.value)}
                      placeholder="Ej. M1"
                      required
                      value={tableCode}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="table-seats">Comensales máximos</FieldLabel>
                    <Input
                      id="table-seats"
                      min={1}
                      onChange={(event) => setTableSeats(Number(event.target.value))}
                      placeholder="4"
                      required
                      type="number"
                      value={tableSeats}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={tableAccessible}
                      onChange={(event) => setTableAccessible(event.target.checked)}
                      type="checkbox"
                    />
                    Mesa accesible
                  </label>
                  <FormFeedback pendingLabel="Guardando cambios…" state={feedback.state} />
                  <Button disabled={feedback.pending} type="submit">
                    Añadir mesa
                  </Button>
                </form>
              )}
              <div className="mt-6 border-t pt-6">
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={history.past.length === 0}
                    onClick={() => setHistory(undoEditorHistory)}
                    type="button"
                  >
                    Deshacer
                  </Button>
                  <Button
                    disabled={history.future.length === 0}
                    onClick={() => setHistory(redoEditorHistory)}
                    type="button"
                  >
                    Rehacer
                  </Button>
                  <Button disabled={feedback.pending} onClick={() => void savePlan()} type="button">
                    Guardar plano
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <DialogRoot onOpenChange={setCreateAreaOpen} open={createAreaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva planta o zona</DialogTitle>
            <DialogDescription>
              Prepara un plano independiente para esta zona del local.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void createArea()
            }}
          >
            <Field>
              <FieldLabel htmlFor="new-area-name">Nombre</FieldLabel>
              <Input
                id="new-area-name"
                onChange={(event) => setNewAreaName(event.target.value)}
                value={newAreaName}
                required
              />
            </Field>
            <DialogFooter>
              <Button onClick={() => setCreateAreaOpen(false)} type="button" variant="outline">
                Cancelar
              </Button>
              <Button disabled={creatingArea || feedback.pending} type="submit">
                {creatingArea ? 'Creando plano…' : 'Crear planta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
      <DialogRoot
        onOpenChange={(open) => !open && setAddElementAt(undefined)}
        open={Boolean(addElementAt)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>¿Qué quieres añadir?</DialogTitle>
            <DialogDescription>
              Para empezar, añade una mesa. Después podrás añadir paredes, puertas y otras zonas.
            </DialogDescription>
          </DialogHeader>
          <Button
            className="h-auto justify-start gap-3 py-4 text-base"
            onClick={() => {
              if (addElementAt) {
                setTableXCm(Math.max(0, Math.round(addElementAt.x / gridSize) * gridSize))
                setTableYCm(Math.max(0, Math.round(addElementAt.y / gridSize) * gridSize))
              }
              void createTable(undefined, addElementAt)
              setAddElementAt(undefined)
            }}
            type="button"
          >
            <Table2 className="size-5" />
            Añadir mesa
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['wall', 'Pared', Square],
                ['door', 'Puerta', DoorOpen],
                ['bar', 'Barra', PanelTop],
                ['stairs', 'Escalera', Footprints],
                ['plant', 'Planta', Armchair],
                ['bathroom', 'Baño', Bath],
                ['kitchen', 'Cocina', Soup],
              ] as const
            ).map(([kind, label, Icon]) => (
              <Button
                className="h-auto justify-start gap-2 py-4"
                key={kind}
                onClick={() => {
                  addElement(kind, addElementAt)
                  setAddElementAt(undefined)
                }}
                type="button"
                variant="outline"
              >
                <Icon className="size-5" />
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </DialogRoot>
    </section>
  )
}
