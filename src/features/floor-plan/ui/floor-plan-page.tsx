import {
  Button,
  Card,
  CardContent,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogFooter,
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
  Plus,
  RotateCw,
  Soup,
  Square,
  Table2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  createFloorPlanTable,
  createFloorPlanArea,
  deleteFloorPlanArea,
  updateFloorPlanArea,
  updateFloorPlanTableCode,
  saveFloorPlan,
} from '../application/floor-plan'
import { commitEditorHistory, createEditorHistory } from '../domain/editor-history'
import {
  type FloorPlanData,
  type FloorPlanElement,
  type PlanElementKind,
  nextAvailableTableCode,
} from '../domain/floor-plan'
import {
  DEFAULT_GRID_SIZE_CM,
  findPlacementCollisions,
  findBlockedAccesses,
  isPlacementWithinBounds,
  movePlacement,
  rotatePlacement,
  validateLayout,
} from '../domain/geometry'

const elementDefaults: Record<PlanElementKind, { widthCm: number; heightCm: number }> = {
  wall: { widthCm: 250, heightCm: 25 },
  door: { widthCm: 100, heightCm: 100 },
  window: { widthCm: 150, heightCm: 20 },
  bar: { widthCm: 250, heightCm: 100 },
  stairs: { widthCm: 150, heightCm: 250 },
  plant: { widthCm: 60, heightCm: 60 },
  label: { widthCm: 100, heightCm: 40 },
  other: { widthCm: 100, heightCm: 100 },
  pillar: { widthCm: 40, heightCm: 40 },
  bathroom: { widthCm: 200, heightCm: 200 },
  kitchen: { widthCm: 300, heightCm: 200 },
  exit: { widthCm: 100, heightCm: 100 },
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
  const defaultTableSeats = 4
  const [previewDevice] = useState<FloorPlanPreviewDevice>('desktop')
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const gridSize = DEFAULT_GRID_SIZE_CM
  const [selectedAreaId, setSelectedAreaId] = useState(data.areas[0]?.id)
  const [initializing, setInitializing] = useState(false)
  const [initializationFailed, setInitializationFailed] = useState(false)
  const [createAreaOpen, setCreateAreaOpen] = useState(false)
  const [newAreaName, setNewAreaName] = useState('Terraza')
  const [newAreaWidth, setNewAreaWidth] = useState(800)
  const [newAreaHeight, setNewAreaHeight] = useState(600)
  const [renameAreaOpen, setRenameAreaOpen] = useState(false)
  const [areaName, setAreaName] = useState('')
  const [renamingArea, setRenamingArea] = useState(false)
  const [deleteAreaOpen, setDeleteAreaOpen] = useState(false)
  const [deletingArea, setDeletingArea] = useState(false)
  const [planWidth, setPlanWidth] = useState(800)
  const [planHeight, setPlanHeight] = useState(600)
  const [resizedPlan, setResizedPlan] = useState<{
    areaId: string
    heightCm: number
    widthCm: number
  }>()
  const [creatingArea, setCreatingArea] = useState(false)
  const [pendingTableIds, setPendingTableIds] = useState<ReadonlySet<string>>(new Set())
  const pendingTableCodesRef = useRef(new Set<string>())
  const [addElementAt, setAddElementAt] = useState<{ x: number; y: number }>()
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false)
  const [dimensionsDialogOpen, setDimensionsDialogOpen] = useState(false)
  const autosaveTimeoutRef = useRef<number | undefined>(undefined)
  const loadedAutosaveAreaRef = useRef<string | undefined>(undefined)
  const [dialogItemId, setDialogItemId] = useState<string>()
  async function reloadFloorPlan() {
    await reload()
    await queryClient.refetchQueries({
      queryKey: ['tenant', tenantId, 'venue', venueId, 'floor-plan'],
    })
  }
  const loadedActiveArea = data.areas.find((area) => area.id === selectedAreaId) ?? data.areas[0]
  const activeArea = loadedActiveArea
    ? { ...loadedActiveArea, ...(resizedPlan?.areaId === loadedActiveArea.id ? resizedPlan : {}) }
    : undefined
  const activeAreaId = activeArea?.id
  useAsyncEffect(() => {
    if (activeArea) {
      setPlanWidth(activeArea.widthCm)
      setPlanHeight(activeArea.heightCm)
    }
  }, [activeArea?.id, activeArea?.widthCm, activeArea?.heightCm])
  async function resizePlan(): Promise<boolean> {
    if (!activeArea || planWidth < 100 || planHeight < 100) return false
    feedback.setPending()
    try {
      await saveFloorPlan({
        data: {
          elements,
          areaId: activeArea.id,
          tenantId,
          venueId,
          widthCm: planWidth,
          heightCm: planHeight,
          placements,
        },
      })
      feedback.setSuccess('Tamaño del plano actualizado.')
      setResizedPlan({ areaId: activeArea.id, heightCm: planHeight, widthCm: planWidth })
      // The explicit resize already persists the map. Do not let the editor
      // autosave immediately save the old dimensions.
      if (autosaveTimeoutRef.current !== undefined) {
        window.clearTimeout(autosaveTimeoutRef.current)
        autosaveTimeoutRef.current = undefined
      }
      skipNextAutosave.current = true
      return true
    } catch {
      feedback.setError('No se ha podido cambiar el tamaño del plano.')
      return false
    }
  }
  async function createInitialArea() {
    if (initializing) return
    setInitializing(true)
    feedback.setPending()
    try {
      await createFloorPlanArea({
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
      await reloadFloorPlan()
      feedback.setSuccess('Sala principal creada.')
      setInitializationFailed(false)
    } catch {
      setInitializationFailed(true)
      feedback.setError('No se ha podido crear la sala principal.')
    } finally {
      setInitializing(false)
    }
  }
  const savedPlacements = activeArea
    ? data.placements.filter((placement) => placement.areaId === activeArea.id)
    : []
  const savedElements = activeArea
    ? data.elements.filter((element) => element.areaId === activeArea.id)
    : []
  const [history, setHistory] = useState(() =>
    createEditorHistory({
      elements: savedElements,
      placements: savedPlacements,
    }),
  )
  const { elements, placements } = history.present
  useEffect(() => {
    if (data.areas.some((area) => area.id === selectedAreaId)) return
    const nextArea = data.areas[0]
    setSelectedAreaId(nextArea?.id)
    setResizedPlan(undefined)
    setSelectedId(undefined)
    setSelectedIds([])
    setHistory(
      createEditorHistory({
        elements: nextArea ? data.elements.filter((element) => element.areaId === nextArea.id) : [],
        placements: nextArea
          ? data.placements.filter((placement) => placement.areaId === nextArea.id)
          : [],
      }),
    )
  }, [data.areas, data.elements, data.placements, selectedAreaId])
  const autosaveReady = useRef(false)
  const skipNextAutosave = useRef(false)
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
  const layoutIssues = activeArea ? validateLayout(placements, activeArea) : []
  const blockedAccesses = findBlockedAccesses(placements, elements)
  async function createArea() {
    const areaName = newAreaName.trim()
    if (!areaName) return
    setCreatingArea(true)
    feedback.setPending()
    try {
      await createFloorPlanArea({
        data: {
          areaName,
          floorNumber: null,
          heightCm: newAreaHeight,
          outdoorOpen: true,
          spaceType: areaName.toLocaleLowerCase().includes('terraza')
            ? 'outdoor_terrace'
            : 'indoor',
          tenantId,
          venueId,
          widthCm: newAreaWidth,
        },
      })
      feedback.setSuccess(`${areaName} creada.`)
      await reloadFloorPlan()
      setCreateAreaOpen(false)
      setNewAreaName('Terraza')
    } catch {
      feedback.setError('No se ha podido crear la nueva zona.')
    } finally {
      setCreatingArea(false)
    }
  }

  function openRenameArea() {
    if (!activeArea) return
    setAreaName(activeArea.name)
    setRenameAreaOpen(true)
  }

  async function renameArea() {
    if (!activeArea) return
    const nextName = areaName.trim()
    if (!nextName) return
    setRenamingArea(true)
    feedback.setPending()
    try {
      await updateFloorPlanArea({
        data: { areaId: activeArea.id, areaName: nextName, tenantId, venueId },
      })
      setRenameAreaOpen(false)
      feedback.setSuccess('Zona renombrada.')
      await reloadFloorPlan()
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? 'Ya existe otra zona con ese nombre.'
          : 'No se ha podido renombrar la zona.',
      )
    } finally {
      setRenamingArea(false)
    }
  }

  async function deleteArea() {
    if (!activeArea) return
    setDeletingArea(true)
    feedback.setPending()
    try {
      await deleteFloorPlanArea({
        data: { areaId: activeArea.id, tenantId, venueId },
      })
      setDeleteAreaOpen(false)
      feedback.setSuccess('Zona eliminada.')
      await reloadFloorPlan()
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? 'Vacía la zona de mesas y elementos antes de eliminarla.'
          : 'No se ha podido eliminar la zona.',
      )
    } finally {
      setDeletingArea(false)
    }
  }

  function moveItem(id: string, xCm: number, yCm: number) {
    if (placements.some((item) => item.id === id)) {
      changePlacement(id, xCm, yCm)
      return
    }
    const element = elements.find((item) => item.id === id)
    if (!element || !activeArea) return
    const next = {
      ...element,
      xCm: Math.round(xCm / gridSize) * gridSize,
      yCm: Math.round(yCm / gridSize) * gridSize,
    }
    if (!isPlacementWithinBounds(next, activeArea)) return
    setHistory((current) =>
      commitEditorHistory(current, {
        ...current.present,
        elements: current.present.elements.map((item) => (item.id === id ? next : item)),
      }),
    )
  }

  async function createTable(position: { x: number; y: number }, code: string) {
    if (!activeArea) return
    feedback.setPending()
    const optimisticId = crypto.randomUUID()
    pendingTableCodesRef.current.add(code)
    setPendingTableIds((current) => new Set(current).add(optimisticId))
    const optimisticPlacement = {
      code,
      areaId: activeArea.id,
      heightCm: 100,
      id: optimisticId,
      maxSeats: defaultTableSeats,
      minSeats: 1,
      normalSeats: defaultTableSeats,
      widthCm: 100,
      xCm: position.x,
      yCm: position.y,
    }
    setHistory((current) =>
      commitEditorHistory(current, {
        ...current.present,
        placements: [...current.present.placements, optimisticPlacement],
      }),
    )

    try {
      await createFloorPlanTable({
        data: {
          areaId: activeArea.id,
          code,
          heightCm: 100,
          maxSeats: defaultTableSeats,
          minSeats: 1,
          isAccessible: false,
          tableId: optimisticId,
          tenantId,
          venueId,
          widthCm: 100,
          xCm: position.x,
          yCm: position.y,
        },
      })
      setPendingTableIds((current) => {
        const next = new Set(current)
        next.delete(optimisticId)
        return next
      })
      feedback.setSuccess('Mesa añadida.')
    } catch (error) {
      pendingTableCodesRef.current.delete(code)
      setPendingTableIds((current) => {
        const next = new Set(current)
        next.delete(optimisticId)
        return next
      })
      skipNextAutosave.current = true
      setHistory((current) =>
        commitEditorHistory(current, {
          ...current.present,
          placements: current.present.placements.filter(
            (placement) => placement.id !== optimisticId,
          ),
        }),
      )
      feedback.setError(
        error instanceof Response && error.status === 422
          ? 'No hay espacio libre en ese punto. Prueba a soltar la mesa en otra zona.'
          : error instanceof Error && error.message.includes('23505')
            ? 'Ya existe una mesa con ese código.'
            : 'No se ha podido añadir la mesa. Inténtalo de nuevo.',
      )
    }
  }

  function createQuickTable(position: { x: number; y: number }) {
    if (!activeArea) return
    const number = nextAvailableTableCode(
      [...(data.tableCodes ?? []), ...placements.map((placement) => placement.code)],
      [...pendingTableCodesRef.current],
    )
    const tableSize = { heightCm: 100, widthCm: 100 }
    const requested = {
      xCm: Math.min(
        Math.max(0, Math.round(position.x / gridSize) * gridSize),
        activeArea.widthCm - tableSize.widthCm,
      ),
      yCm: Math.min(
        Math.max(0, Math.round(position.y / gridSize) * gridSize),
        activeArea.heightCm - tableSize.heightCm,
      ),
    }
    const candidate = Array.from({ length: 200 }, (_, index) => {
      const step = 50
      return {
        ...tableSize,
        id: 'new-table',
        xCm: Math.max(0, requested.xCm + (index % 10) * step),
        yCm: Math.max(0, requested.yCm + Math.floor(index / 10) * step),
      }
    }).find(
      (item) =>
        isPlacementWithinBounds(item, activeArea) &&
        findPlacementCollisions(item, placements).length === 0,
    )
    if (!candidate) {
      feedback.setError('No hay espacio libre suficiente para colocar otra mesa.')
      return
    }
    void createTable({ x: candidate.xCm, y: candidate.yCm }, String(number))
  }

  function changePlacement(id: string, xCm: number, yCm: number) {
    if (!activeArea) return
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
      !isPlacementWithinBounds(candidate, activeArea) ||
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
    setSelectedAreaId(areaId)
    setResizedPlan(undefined)
    setSelectedId(undefined)
    setSelectedIds([])
    setHistory(
      createEditorHistory({
        elements: data.elements.filter((element) => element.areaId === areaId),
        placements: data.placements.filter((placement) => placement.areaId === areaId),
      }),
    )
  }

  function addElement(kind: PlanElementKind, position = { x: 0, y: 0 }) {
    if (!activeArea) return
    const element: FloorPlanElement = {
      areaId: activeArea.id,
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
    values: Partial<Pick<FloorPlanElement, 'heightCm' | 'label' | 'widthCm' | 'xCm' | 'yCm'>> & {
      code?: string
    },
  ) {
    const itemId = selectedId ?? dialogItemId
    if (!itemId || !activeArea) return
    const selectedTable = placements.find((item) => item.id === itemId)
    const selectedElement = elements.find((item) => item.id === itemId)
    const selected = selectedTable ?? selectedElement
    if (!selected) return
    const candidate = { ...selected, ...values }
    if (candidate.widthCm <= 0 || candidate.heightCm <= 0) {
      feedback.setError('El tamaño debe ser positivo.')
      return
    }
    if (!isPlacementWithinBounds(candidate, activeArea)) {
      feedback.setError('El elemento debe quedar completamente dentro del plano.')
      return
    }
    if (
      selectedTable &&
      findPlacementCollisions(
        candidate,
        placements.filter((item) => item.id !== itemId),
      ).length > 0
    ) {
      feedback.setError('La mesa se solapa con otra mesa.')
      return
    }
    const nextElements = elements.map((item) =>
      item.id === itemId ? { ...item, ...values } : item,
    )
    const nextPlacements = placements.map((item) =>
      item.id === itemId ? { ...item, ...values } : item,
    )
    setHistory((current) =>
      commitEditorHistory(current, {
        elements: nextElements,
        placements: nextPlacements,
      }),
    )
  }

  async function savePlan() {
    if (!activeArea) return
    if (layoutIssues.length > 0) {
      feedback.setError('Corrige los problemas del plano antes de publicarlo.')
      return
    }
    feedback.setPending()
    try {
      await saveFloorPlan({
        data: {
          elements,
          areaId: activeArea.id,
          placements,
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Plano guardado.')
      await reloadFloorPlan()
    } catch {
      feedback.setError('No se ha podido guardar el plano.')
    }
  }

  const savePlanRef = useRef(savePlan)
  useEffect(() => {
    savePlanRef.current = savePlan
    // This effect intentionally tracks the latest callback for the autosave timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [savePlan])

  useEffect(() => {
    if (!activeAreaId) return
    if (propertiesDialogOpen) return
    if (loadedAutosaveAreaRef.current !== activeAreaId) {
      loadedAutosaveAreaRef.current = activeAreaId
      autosaveReady.current = true
      return
    }
    if (pendingTableIds.size > 0) return
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }
    if (!autosaveReady.current) {
      autosaveReady.current = true
      return
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      autosaveTimeoutRef.current = undefined
      void savePlanRef.current()
    }, 600)
    return () => {
      if (autosaveTimeoutRef.current !== undefined) {
        window.clearTimeout(autosaveTimeoutRef.current)
        autosaveTimeoutRef.current = undefined
      }
    }
  }, [activeAreaId, elements, pendingTableIds, placements, propertiesDialogOpen])

  return (
    <section
      aria-busy={initializing}
      className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col gap-2 overflow-x-hidden overflow-y-auto"
    >
      <PageHeader className="border-border/70 shrink-0 border-b pb-2">
        <div>
          <PageHeaderTitle className="text-lg">Plano de sala</PageHeaderTitle>
          <PageHeaderDescription className="text-xs">
            Coloca las mesas y algunos puntos de referencia para orientarte durante el servicio.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <FormFeedback className="shrink-0" pendingLabel="Guardando cambios…" state={feedback.state} />
      {initializationFailed ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-destructive text-sm" role="alert">
              No se ha podido crear la sala principal.
            </p>
            <Button
              onClick={() => void createInitialArea()}
              size="sm"
              type="button"
              variant="outline"
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {!activeArea ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 text-center">
            <p className="text-muted-foreground text-sm">
              Todavía no hay zonas configuradas en este local.
            </p>
            <Button disabled={initializing} onClick={() => void createInitialArea()} type="button">
              {initializing ? 'Creando sala…' : 'Crear sala principal'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-h-0 flex-col gap-2">
          <div
            className="relative z-20 flex min-h-9 shrink-0 items-center gap-1 overflow-x-auto"
            role="tablist"
            aria-label="Plantas y zonas"
          >
            {data.areas.map((area) => (
              <Button
                aria-selected={area.id === activeArea?.id}
                className="h-8 shrink-0 px-2.5 text-xs"
                key={area.id}
                onClick={() => switchArea(area.id)}
                type="button"
                variant={area.id === activeArea?.id ? 'default' : 'outline'}
              >
                {area.name}
              </Button>
            ))}
            <Button
              className="h-8 shrink-0 px-2.5 text-xs"
              onClick={() => setCreateAreaOpen(true)}
              type="button"
              variant="outline"
            >
              + Añadir planta o zona
            </Button>
          </div>
          <div className="relative z-0">
            <FloorPlanCanvas
              activeArea={activeArea}
              blockedAccesses={blockedAccesses}
              elements={elements}
              gridSize={gridSize}
              layoutIssues={layoutIssues}
              onClearSelection={() => {
                setSelectedId(undefined)
                setSelectedIds([])
              }}
              onEmptyPlace={(x, y) => setAddElementAt({ x, y })}
              onCreateTable={createQuickTable}
              onDropElement={(kind, x, y) => addElement(kind, { x, y })}
              onMoveItem={moveItem}
              onItemClick={(id) => {
                selectItem(id)
                setDialogItemId(id)
                setPropertiesDialogOpen(true)
              }}
              onEditDimensions={() => setDimensionsDialogOpen(true)}
              onRenameArea={openRenameArea}
              onDeleteArea={() => setDeleteAreaOpen(true)}
              onSelectItem={selectItem}
              placements={placements}
              previewDevice={previewDevice}
              selectedIds={selectedIds}
            />
            <Button
              className="absolute right-6 bottom-6 z-10 rounded-full px-4 shadow-lg"
              onClick={() =>
                activeArea &&
                setAddElementAt({
                  x: activeArea.widthCm / 2,
                  y: activeArea.heightCm / 2,
                })
              }
              type="button"
            >
              <Plus className="size-4" /> Añadir
            </Button>
          </div>
          <DialogRoot onOpenChange={setDimensionsDialogOpen} open={dimensionsDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Medidas del plano</DialogTitle>
                <DialogDescription>Define el tamaño real de esta sala.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="dialog-plan-width">Ancho (cm)</FieldLabel>
                  <Input
                    id="dialog-plan-width"
                    min={100}
                    onChange={(event) => setPlanWidth(Number(event.target.value))}
                    type="number"
                    value={planWidth}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dialog-plan-height">Fondo (cm)</FieldLabel>
                  <Input
                    id="dialog-plan-height"
                    min={100}
                    onChange={(event) => setPlanHeight(Number(event.target.value))}
                    type="number"
                    value={planHeight}
                  />
                </Field>
              </div>
              <p className="text-muted-foreground text-sm">
                {(planWidth / 100).toFixed(2)} × {(planHeight / 100).toFixed(2)} m
              </p>
              <Button
                disabled={feedback.pending}
                onClick={() => {
                  void resizePlan().then((updated) => {
                    if (updated) setDimensionsDialogOpen(false)
                  })
                }}
                type="button"
              >
                Guardar medidas
              </Button>
            </DialogContent>
          </DialogRoot>
          <DialogRoot
            onOpenChange={(open) => {
              setPropertiesDialogOpen(open)
              if (!open) setDialogItemId(undefined)
            }}
            open={propertiesDialogOpen}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Editar mesa o elemento</DialogTitle>
                <DialogDescription>Ajusta sus medidas y posición en centímetros.</DialogDescription>
              </DialogHeader>
              {(() => {
                const itemId = selectedId ?? dialogItemId
                const selectedElement = elements.find((item) => item.id === itemId)
                const selected = placements.find((item) => item.id === itemId) ?? selectedElement
                if (!selected) return null
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {'code' in selected && (
                      <Field className="col-span-2">
                        <FieldLabel htmlFor="dialog-table-code">Número de mesa</FieldLabel>
                        <Input
                          id="dialog-table-code"
                          onChange={(event) => updateSelected({ code: event.target.value })}
                          onBlur={(event) => {
                            void updateFloorPlanTableCode({
                              data: {
                                code: event.target.value,
                                tableId: selected.id,
                                tenantId,
                                venueId,
                              },
                            })
                          }}
                          value={selected.code}
                        />
                      </Field>
                    )}
                    {(['xCm', 'yCm', 'widthCm', 'heightCm'] as const).map((key) => (
                      <Field key={key}>
                        <FieldLabel htmlFor={`dialog-selected-${key}`}>
                          {key.replace('Cm', ' (cm)')}
                        </FieldLabel>
                        <Input
                          id={`dialog-selected-${key}`}
                          min={0}
                          onChange={(event) =>
                            updateSelected({ [key]: Number(event.target.value) })
                          }
                          type="number"
                          value={selected[key]}
                        />
                      </Field>
                    ))}
                    {selectedElement && (
                      <Button
                        className="col-span-2"
                        onClick={() => updateSelected(rotatePlacement(selectedElement))}
                        type="button"
                        variant="outline"
                      >
                        <RotateCw className="size-4" /> Rotar 90°
                      </Button>
                    )}
                    <div className="col-span-2 flex justify-end border-t pt-3">
                      <Button
                        onClick={() => {
                          removeSelected()
                          setPropertiesDialogOpen(false)
                        }}
                        type="button"
                        variant="destructive"
                      >
                        Eliminar elemento
                      </Button>
                    </div>
                  </div>
                )
              })()}
            </DialogContent>
          </DialogRoot>
        </div>
      )}
      <DialogRoot onOpenChange={setCreateAreaOpen} open={createAreaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva planta o zona</DialogTitle>
            <DialogDescription>Añade una zona al plano de este local.</DialogDescription>
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
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="new-area-width">Ancho (cm)</FieldLabel>
                <Input
                  id="new-area-width"
                  min={100}
                  onChange={(event) => setNewAreaWidth(Number(event.target.value))}
                  type="number"
                  value={newAreaWidth}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-area-height">Fondo (cm)</FieldLabel>
                <Input
                  id="new-area-height"
                  min={100}
                  onChange={(event) => setNewAreaHeight(Number(event.target.value))}
                  type="number"
                  value={newAreaHeight}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button onClick={() => setCreateAreaOpen(false)} type="button" variant="outline">
                Cancelar
              </Button>
              <Button disabled={creatingArea || feedback.pending} type="submit">
                {creatingArea ? 'Creando zona…' : 'Crear zona'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
      <DialogRoot
        onOpenChange={(open) => {
          setRenameAreaOpen(open)
          if (!open) setAreaName('')
        }}
        open={renameAreaOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renombrar zona</DialogTitle>
            <DialogDescription>
              El nuevo nombre se aplicará a esta zona del local.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void renameArea()
            }}
          >
            <Field>
              <FieldLabel htmlFor="rename-area-name">Nombre</FieldLabel>
              <Input
                id="rename-area-name"
                onChange={(event) => setAreaName(event.target.value)}
                value={areaName}
                required
              />
            </Field>
            <DialogFooter>
              <Button onClick={() => setRenameAreaOpen(false)} type="button" variant="outline">
                Cancelar
              </Button>
              <Button disabled={renamingArea || feedback.pending} type="submit">
                {renamingArea ? 'Guardando…' : 'Guardar nombre'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
      <DialogRoot onOpenChange={setDeleteAreaOpen} open={deleteAreaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar zona</DialogTitle>
            <DialogDescription>
              {activeArea
                ? `Se eliminará “${activeArea.name}”. Esta acción no se puede deshacer.`
                : 'Esta acción no se puede deshacer.'}
            </DialogDescription>
          </DialogHeader>
          {activeArea && (placements.length > 0 || elements.length > 0) ? (
            <p className="text-destructive text-sm" role="alert">
              Esta zona contiene {placements.length} mesa{placements.length === 1 ? '' : 's'} y{' '}
              {elements.length} elemento{elements.length === 1 ? '' : 's'}. Elimínalos antes de
              borrar la zona.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Solo se pueden eliminar zonas vacías, para evitar borrar su configuración por error.
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setDeleteAreaOpen(false)} type="button" variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={
                deletingArea || feedback.pending || placements.length > 0 || elements.length > 0
              }
              onClick={() => void deleteArea()}
              type="button"
              variant="destructive"
            >
              {deletingArea ? 'Eliminando…' : 'Eliminar zona'}
            </Button>
          </DialogFooter>
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
              if (addElementAt) createQuickTable(addElementAt)
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
