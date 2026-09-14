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
import { DoorOpen, Footprints, Grid2X2, LayoutGrid, PanelTop, Soup, Square } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
  type KeyboardEvent,
  type DragEvent,
} from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  createFloorPlanTable,
  createInitialFloorPlan,
  createEventLayoutTemplate,
  deleteEventLayoutTemplate,
  updateEventLayoutTemplate,
  createTableGroupPreset,
  deleteTableGroupPreset,
  saveFloorPlanVersion,
} from '../application/floor-plan'
import { detectLayoutSourceKind } from '../application/layout-source-parser'
import {
  commitEditorHistory,
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
} from '../domain/editor-history'
import {
  findVersionScheduleConflicts,
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
import {
  createLayoutTemplate,
  parseLayoutTemplate,
  serializeLayoutTemplate,
} from '../domain/layout-template'
import { inspectTableGroupPresetAvailability } from '../domain/table-group-presets'
import { FloorPlanCanvas } from './floor-plan-canvas'
import { FloorPlanEventTemplates, type EventTemplateValues } from './floor-plan-event-templates'
import type { FloorPlanPreviewDevice } from './floor-plan-setup-card'

function readLockedIds(lockStorageKey: string | undefined): string[] {
  if (!lockStorageKey || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(lockStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

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
  const [tableCode, setTableCode] = useState('1')
  const [tableSeats, setTableSeats] = useState(4)
  const [tableAccessible, setTableAccessible] = useState(false)
  const [tableXCm, setTableXCm] = useState(50)
  const [tableYCm, setTableYCm] = useState(50)
  const [presetName, setPresetName] = useState('Combinación')
  const [presetMaxSeats, setPresetMaxSeats] = useState(8)
  const [versionName, setVersionName] = useState('Nueva versión')
  const [versionActivation, setVersionActivation] = useState('')
  const [versionDeactivation, setVersionDeactivation] = useState('')
  const templateInputRef = useRef<HTMLInputElement>(null)
  const [previewDevice] = useState<FloorPlanPreviewDevice>('desktop')
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE_CM)
  const [minimumAisleCm, setMinimumAisleCm] = useState(90)
  const [selectedAreaId, setSelectedAreaId] = useState(data.areas[0]?.id)
  const [initializing, setInitializing] = useState(false)
  const [createAreaOpen, setCreateAreaOpen] = useState(false)
  const [newAreaName, setNewAreaName] = useState('Terraza')
  const [creatingArea, setCreatingArea] = useState(false)
  const [addElementAt, setAddElementAt] = useState<{ x: number; y: number }>()
  const activeArea = data.areas.find((area) => area.id === selectedAreaId) ?? data.areas[0]
  const activePresets = data.tableGroupPresets.filter((preset) => preset.areaId === activeArea?.id)
  const activeVersion = activeArea
    ? (selectFloorPlanVersion(data.versions, activeArea.id) ??
      data.versions.find((version) => version.areaId === activeArea.id))
    : undefined
  useAsyncEffect(() => {
    if (data.areas.length > 0 || initializing) return
    setInitializing(true)
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
      .then(() => reload())
      .catch(() => feedback.setError('No se ha podido preparar el plano inicial.'))
  }, [data.areas.length, feedback, initializing, reload, tenantId, venueId])
  const lockStorageKey = activeVersion
    ? `sobretaula:floor-plan-locks:${activeVersion.id}`
    : undefined
  const [lockedIds, setLockedIds] = useState(() => {
    const local = readLockedIds(lockStorageKey)
    const persisted = data.placements
      .filter((placement) => placement.isLocked)
      .map((placement) => placement.id)
    return [...new Set([...persisted, ...local])]
  })
  useEffect(() => {
    if (!lockStorageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(lockStorageKey, JSON.stringify(lockedIds))
    } catch {
      // Private browsing and full storage must not prevent editing the plan.
    }
  }, [lockStorageKey, lockedIds])
  const savedPlacements = activeVersion
    ? data.placements.filter((placement) => placement.floorPlanVersionId === activeVersion.id)
    : []
  const savedElements = activeVersion
    ? data.elements.filter((element) => element.floorPlanVersionId === activeVersion.id)
    : []
  const [history, setHistory] = useState(() =>
    createEditorHistory({ elements: savedElements, placements: savedPlacements }),
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
  function exportTemplate() {
    if (!activeVersion) return
    const template = createLayoutTemplate({
      widthCm: activeVersion.widthCm,
      heightCm: activeVersion.heightCm,
      tables: placements,
      elements,
    })
    const blob = new Blob([serializeLayoutTemplate(template)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${activeVersion.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'plano'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  function importTemplate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !activeVersion) return
    const sourceKind = detectLayoutSourceKind(file.type, file.name)
    if (sourceKind && sourceKind !== 'json') {
      feedback.setError('Las imágenes y PDFs requieren extracción asistida antes de publicarse.')
      return
    }
    if (!sourceKind) {
      feedback.setError('Formato no compatible. Usa JSON, imagen o PDF.')
      return
    }
    void file.text().then((value) => {
      try {
        const template = parseLayoutTemplate(value)
        const nextPlacements = template.tables.map((table) => ({
          ...table,
          id: crypto.randomUUID(),
          floorPlanVersionId: activeVersion.id,
        }))
        const nextElements = template.elements.map((element) => ({
          ...element,
          id: crypto.randomUUID(),
          floorPlanVersionId: activeVersion.id,
        }))
        setHistory((current) =>
          commitEditorHistory(current, { placements: nextPlacements, elements: nextElements }),
        )
        setSelectedId(undefined)
        setSelectedIds([])
        feedback.setSuccess('Plantilla cargada en el editor. Revísala antes de guardar.')
      } catch (error) {
        feedback.setError(
          error instanceof Error ? error.message : 'No se ha podido leer la plantilla.',
        )
      }
    })
  }
  async function createEventTemplate(values: EventTemplateValues) {
    if (!activeVersion || !activeArea || !values.name.trim() || !values.activeFrom) {
      feedback.setError('Indica nombre y fecha de inicio del evento.')
      return
    }
    feedback.setPending()
    try {
      const payload = {
        activeFrom: new Date(values.activeFrom).toISOString(),
        activeTo: values.activeTo ? new Date(values.activeTo).toISOString() : null,
        areaIds: [activeArea.id],
        layout: createLayoutTemplate({
          widthCm: activeVersion.widthCm,
          heightCm: activeVersion.heightCm,
          tables: placements,
          elements,
        }) as unknown as Record<string, unknown>,
        name: values.name,
        tenantId,
        venueId,
      }
      if (values.editingEventId)
        await updateEventLayoutTemplate({
          data: { ...payload, templateId: values.editingEventId },
        })
      else await createEventLayoutTemplate({ data: payload })
      feedback.setSuccess(
        values.editingEventId
          ? 'Plantilla de evento actualizada.'
          : 'Plantilla de evento guardada.',
      )
      reload()
    } catch {
      feedback.setError('No se ha podido guardar la plantilla de evento.')
    }
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
      reload()
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
    if (!element || !activeVersion || lockedIds.includes(id)) return
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

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeArea || !activeVersion) return
    feedback.setPending()

    try {
      await createFloorPlanTable({
        data: {
          areaId: activeArea.id,
          code: tableCode,
          heightCm: 100,
          maxSeats: tableSeats,
          minSeats: 1,
          isAccessible: tableAccessible,
          tenantId,
          venueId,
          versionId: activeVersion.id,
          widthCm: 100,
          xCm: tableXCm,
          yCm: tableYCm,
        },
      })
      reload()
    } catch {
      feedback.setError('La mesa queda fuera del plano, se solapa o ya existe ese código.')
    }
  }

  function changePlacement(id: string, xCm: number, yCm: number) {
    if (lockedIds.includes(id)) return
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
    setLockedIds(readLockedIds(version ? `sobretaula:floor-plan-locks:${version.id}` : undefined))
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
    if (lockedIds.includes(id)) return
    const distance = event.shiftKey ? 5 : gridSize
    const current = placements.find((placement) => placement.id === id)
    const currentElement = elements.find((element) => element.id === id)
    const movable = current ?? currentElement
    if (!movable || lockedIds.includes(id)) return
    const displacement = {
      ArrowDown: { x: 0, y: distance },
      ArrowLeft: { x: -distance, y: 0 },
      ArrowRight: { x: distance, y: 0 },
      ArrowUp: { x: 0, y: -distance },
    }[event.key]
    if (!displacement) return
    event.preventDefault()
    if (current) changePlacement(id, current.xCm + displacement.x, current.yCm + displacement.y)
    else updateSelected({ xCm: movable.xCm + displacement.x, yCm: movable.yCm + displacement.y })
  }

  function addElement(kind: PlanElementKind, position = { x: 0, y: 0 }) {
    if (!activeVersion) return
    const element: FloorPlanElement = {
      floorPlanVersionId: activeVersion.id,
      heightCm: kind === 'wall' ? 25 : 100,
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
      rotationDeg: 0,
      widthCm: kind === 'wall' ? 250 : 100,
      xCm: Math.max(0, Math.round(position.x / gridSize) * gridSize),
      yCm: Math.max(0, Math.round(position.y / gridSize) * gridSize),
    }
    setHistory((current) =>
      commitEditorHistory(current, { ...current.present, elements: [...elements, element] }),
    )
  }

  function duplicateSelected() {
    if (!selectedId || !activeVersion) return
    if (lockedIds.includes(selectedId)) {
      feedback.setError('Desbloquea el elemento antes de duplicarlo.')
      return
    }
    const table = placements.find((item) => item.id === selectedId)
    if (table) {
      const copyId = crypto.randomUUID()
      const copy = Array.from({ length: 40 }, (_, index) => ({
        ...table,
        id: copyId,
        code: `${table.code}-copia`,
        xCm: table.xCm + ((index + 1) % 8) * 25,
        yCm: table.yCm + Math.floor((index + 1) / 8) * 25,
      })).find(
        (candidate) =>
          isPlacementWithinBounds(candidate, activeVersion) &&
          findPlacementCollisions(candidate, placements).length === 0,
      )
      if (!copy) {
        feedback.setError('No hay espacio libre suficiente para duplicar esta mesa.')
        return
      }
      setHistory((current) =>
        commitEditorHistory(current, { ...current.present, placements: [...placements, copy] }),
      )
      selectItem(copy.id)
      return
    }
    const element = elements.find((item) => item.id === selectedId)
    if (element) {
      const copy = {
        ...element,
        id: crypto.randomUUID(),
        xCm: element.xCm + 25,
        yCm: element.yCm + 25,
      }
      setHistory((current) =>
        commitEditorHistory(current, { ...current.present, elements: [...elements, copy] }),
      )
      selectItem(copy.id)
    }
  }

  function removeSelected() {
    if (!selectedId) return
    const ids = selectedIds.length > 0 ? selectedIds : [selectedId]
    const locked = ids.filter((id) => lockedIds.includes(id))
    if (locked.length > 0) {
      feedback.setError('Desbloquea los elementos seleccionados antes de eliminarlos.')
      return
    }
    setHistory((current) =>
      commitEditorHistory(current, {
        elements: elements.filter((item) => !ids.includes(item.id)),
        placements: placements.filter((item) => !ids.includes(item.id)),
      }),
    )
    setSelectedId(undefined)
    setSelectedIds([])
  }

  function alignSelected(axis: 'x' | 'y' | 'right' | 'bottom') {
    if (!activeVersion || selectedIds.length < 2) return
    const selected = placements.filter((item) => selectedIds.includes(item.id))
    const target =
      axis === 'right' || axis === 'bottom'
        ? Math.max(
            ...selected.map((item) =>
              axis === 'right' ? item.xCm + item.widthCm : item.yCm + item.heightCm,
            ),
          )
        : Math.min(...selected.map((item) => (axis === 'x' ? item.xCm : item.yCm)))
    const next = placements.map((item) =>
      selectedIds.includes(item.id)
        ? {
            ...item,
            [axis === 'x' || axis === 'right' ? 'xCm' : 'yCm']:
              axis === 'right'
                ? target - item.widthCm
                : axis === 'bottom'
                  ? target - item.heightCm
                  : target,
          }
        : item,
    )
    if (
      next.some((item) => !isPlacementWithinBounds(item, activeVersion)) ||
      next.some((item) => findPlacementCollisions(item, next).length > 0)
    ) {
      feedback.setError('La alineación provocaría un solape o saldría del plano.')
      return
    }
    setHistory((current) => commitEditorHistory(current, { ...current.present, placements: next }))
  }

  function distributeSelected(axis: 'x' | 'y') {
    if (!activeVersion || selectedIds.length < 3) return
    const selected = placements
      .filter((item) => selectedIds.includes(item.id))
      .sort((a, b) => (axis === 'x' ? a.xCm - b.xCm : a.yCm - b.yCm))
    const first = selected[0]
    const last = selected[selected.length - 1]
    if (!first || !last) return
    const span =
      (axis === 'x' ? last.xCm - first.xCm : last.yCm - first.yCm) / (selected.length - 1)
    const next = placements.map((item) => {
      const index = selected.findIndex((candidate) => candidate.id === item.id)
      if (index <= 0 || index === selected.length - 1) return item
      return {
        ...item,
        [axis === 'x' ? 'xCm' : 'yCm']:
          Math.round((first[axis === 'x' ? 'xCm' : 'yCm'] + span * index) / gridSize) * gridSize,
      }
    })
    if (
      next.some((item) => !isPlacementWithinBounds(item, activeVersion)) ||
      next.some((item) => findPlacementCollisions(item, next).length > 0)
    ) {
      feedback.setError('La distribución provocaría un solape o saldría del plano.')
      return
    }
    setHistory((current) => commitEditorHistory(current, { ...current.present, placements: next }))
  }

  function updateSelected(
    values: Partial<FloorPlanElement> & {
      xCm?: number
      yCm?: number
      widthCm?: number
      heightCm?: number
      rotationDeg?: number
    },
  ) {
    if (!selectedId || !activeVersion) return
    if (lockedIds.includes(selectedId)) {
      feedback.setError('Desbloquea el elemento para editar sus propiedades.')
      return
    }
    const selectedTable = placements.find((item) => item.id === selectedId)
    const selectedElement = elements.find((item) => item.id === selectedId)
    const selected = selectedTable ?? selectedElement
    if (!selected) return
    const candidate = { ...selected, ...values }
    if (
      candidate.widthCm <= 0 ||
      candidate.heightCm <= 0 ||
      candidate.rotationDeg < 0 ||
      candidate.rotationDeg > 359
    ) {
      feedback.setError('El tamaño debe ser positivo y la rotación estar entre 0° y 359°.')
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
      commitEditorHistory(current, { elements: nextElements, placements: nextPlacements }),
    )
  }

  async function saveTableGroupPreset() {
    if (!activeArea || selectedIds.length < 2) {
      feedback.setError('Selecciona al menos dos mesas para guardar una combinación.')
      return
    }
    feedback.setPending()
    try {
      await createTableGroupPreset({
        data: {
          areaId: activeArea.id,
          maxSeats: presetMaxSeats,
          name: presetName,
          tableIds: selectedIds,
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Combinación guardada.')
      reload()
    } catch {
      feedback.setError('No se ha podido guardar la combinación.')
    }
  }

  async function removeTableGroupPreset(presetId: string) {
    if (!window.confirm('¿Eliminar esta combinación guardada?')) return
    feedback.setPending()
    try {
      await deleteTableGroupPreset({ data: { presetId, tenantId, venueId } })
      feedback.setSuccess('Combinación eliminada.')
      reload()
    } catch {
      feedback.setError('No se ha podido eliminar la combinación.')
    }
  }

  async function saveVersion() {
    if (!activeVersion) return
    if (layoutIssues.length > 0) {
      feedback.setError('Corrige los problemas del plano antes de publicarlo.')
      return
    }
    const activationDate = new Date(versionActivation)
    if (!versionActivation || Number.isNaN(activationDate.getTime())) {
      feedback.setError('Indica una fecha y hora de activación válida.')
      return
    }
    const activeFrom = activationDate.toISOString()
    const deactivationDate = versionDeactivation ? new Date(versionDeactivation) : undefined
    if (
      deactivationDate &&
      (Number.isNaN(deactivationDate.getTime()) || deactivationDate <= activationDate)
    ) {
      feedback.setError('La fecha de fin debe ser posterior a la activación.')
      return
    }
    const scheduleConflicts = findVersionScheduleConflicts([
      ...data.versions,
      { ...activeVersion, id: 'draft-version', activeFrom },
    ])
    if (scheduleConflicts.length > 0) {
      feedback.setError(
        'La fecha se solapa con otra versión de esta zona. Elige otra fecha de activación.',
      )
      return
    }
    feedback.setPending()
    try {
      await saveFloorPlanVersion({
        data: {
          activeFrom,
          activeTo: deactivationDate?.toISOString() ?? null,
          elements,
          name: versionName,
          placements: placements.map((placement) => ({
            ...placement,
            isLocked: lockedIds.includes(placement.id),
          })),
          sourceVersionId: activeVersion.id,
          tenantId,
          venueId,
        },
      })
      reload()
    } catch {
      feedback.setError('No se ha podido guardar la versión del plano.')
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Plano de sala</PageHeaderTitle>
          <PageHeaderDescription>
            Dibuja el recorrido de tu equipo y guarda versiones antes de cada cambio.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <FloorPlanEventTemplates
        activeArea={activeArea}
        activeVersion={activeVersion}
        onDelete={async (template) => {
          feedback.setPending()
          try {
            await deleteEventLayoutTemplate({
              data: { templateId: template.id, tenantId, venueId },
            })
            feedback.setSuccess('Plantilla eliminada.')
            reload()
          } catch {
            feedback.setError('No se ha podido borrar la plantilla.')
          }
        }}
        onSave={createEventTemplate}
        templates={data.eventLayoutTemplates ?? []}
      />
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
            lockedIds={lockedIds}
            minimumAisleCm={minimumAisleCm}
            onClearSelection={() => {
              setSelectedId(undefined)
              setSelectedIds([])
            }}
            onEmptyPlace={(x, y) => setAddElementAt({ x, y })}
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
              <CardTitle>Edición y mesas</CardTitle>
              <CardDescription>Selecciona una mesa o elemento para editarlo.</CardDescription>
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
                  flechas para ajustar. Pulsa R para girar y Ctrl/Cmd+D para duplicar; mantén
                  Ctrl/Cmd para seleccionar varios.
                </output>
              )}
              {selectedId && (
                <div className="mt-3 flex gap-2">
                  <Button onClick={duplicateSelected} type="button" variant="outline">
                    Duplicar
                  </Button>
                  <Button onClick={removeSelected} type="button">
                    Eliminar
                  </Button>
                  <Button
                    onClick={() => {
                      const ids = selectedIds.length > 0 ? selectedIds : [selectedId]
                      setLockedIds((current) => {
                        const allLocked = ids.every((id) => current.includes(id))
                        return allLocked
                          ? current.filter((id) => !ids.includes(id))
                          : [...new Set([...current, ...ids])]
                      })
                    }}
                    type="button"
                    variant="outline"
                  >
                    {selectedIds.length > 1 && selectedIds.every((id) => lockedIds.includes(id))
                      ? 'Desbloquear selección'
                      : lockedIds.includes(selectedId)
                        ? 'Desbloquear'
                        : selectedIds.length > 1
                          ? 'Bloquear selección'
                          : 'Bloquear'}
                  </Button>
                </div>
              )}
              {selectedIds.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => alignSelected('x')} type="button" variant="outline">
                    Alinear izquierda
                  </Button>
                  <Button onClick={() => alignSelected('y')} type="button" variant="outline">
                    Alinear arriba
                  </Button>
                  <Button onClick={() => alignSelected('right')} type="button" variant="outline">
                    Alinear derecha
                  </Button>
                  <Button onClick={() => alignSelected('bottom')} type="button" variant="outline">
                    Alinear abajo
                  </Button>
                  <Button onClick={() => distributeSelected('x')} type="button" variant="outline">
                    Distribuir horizontal
                  </Button>
                  <Button onClick={() => distributeSelected('y')} type="button" variant="outline">
                    Distribuir vertical
                  </Button>
                </div>
              )}
              {selectedIds.length > 1 && (
                <div className="border-border mt-4 grid gap-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Guardar combinación</p>
                  <Input
                    aria-label="Nombre de la combinación"
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="Nombre de la combinación"
                    value={presetName}
                  />
                  <Input
                    aria-label="Capacidad máxima de la combinación"
                    min={1}
                    onChange={(event) => setPresetMaxSeats(Number(event.target.value))}
                    type="number"
                    value={presetMaxSeats}
                  />
                  <Button
                    disabled={feedback.pending}
                    onClick={() => void saveTableGroupPreset()}
                    type="button"
                  >
                    Guardar preset
                  </Button>
                </div>
              )}
              {activePresets.length > 0 && (
                <div className="border-border mt-4 grid gap-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Combinaciones guardadas</p>
                  {activePresets.map((preset) => (
                    <div className="flex gap-2" key={preset.id}>
                      <Button
                        className="min-w-0 flex-1"
                        onClick={() => {
                          const availability = inspectTableGroupPresetAvailability(
                            preset,
                            new Map(placements.map((table) => [table.id, 1])),
                          )
                          if (availability.missingTableIds.length > 0) {
                            feedback.setError(
                              `La combinación contiene ${availability.missingTableIds.length} mesa(s) que ya no existen en esta zona.`,
                            )
                            return
                          }
                          setSelectedIds(availability.availableTableIds)
                          setSelectedId(availability.availableTableIds[0])
                        }}
                        type="button"
                        variant="outline"
                      >
                        {preset.name} · {preset.maxSeats} pax
                      </Button>
                      <Button
                        aria-label={`Eliminar combinación ${preset.name}`}
                        disabled={feedback.pending}
                        onClick={() => void removeTableGroupPreset(preset.id)}
                        type="button"
                        variant="ghost"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
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
                                updateSelected({ [key]: Number(event.target.value) })
                              }
                              type="number"
                              value={selected[key]}
                            />
                          </Field>
                        ))}
                      </div>
                      <Field>
                        <FieldLabel htmlFor="selected-rotation">Rotación (°)</FieldLabel>
                        <Input
                          id="selected-rotation"
                          max={359}
                          min={0}
                          onChange={(event) =>
                            updateSelected({ rotationDeg: Number(event.target.value) })
                          }
                          type="number"
                          value={selected.rotationDeg}
                        />
                      </Field>
                      {'label' in selected && (
                        <Field>
                          <FieldLabel htmlFor="selected-label">Etiqueta</FieldLabel>
                          <Input
                            id="selected-label"
                            onChange={(event) => updateSelected({ label: event.target.value })}
                            value={selected.label ?? ''}
                          />
                        </Field>
                      )}
                    </div>
                  )
                })()}
              <div className="mt-6 space-y-2">
                <p className="text-muted-foreground text-sm">Elementos estructurales</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['wall', 'Pared', Square],
                      ['door', 'Puerta', DoorOpen],
                      ['bar', 'Barra', PanelTop],
                      ['stairs', 'Escalera', Footprints],
                      ['plant', 'Planta', LayoutGrid],
                      ['pillar', 'Pilar', Grid2X2],
                      ['bathroom', 'Baño', Square],
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
                      required
                      type="number"
                      value={tableSeats}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="table-x">X (cm)</FieldLabel>
                      <Input
                        id="table-x"
                        min={0}
                        onChange={(event) => setTableXCm(Number(event.target.value))}
                        required
                        type="number"
                        value={tableXCm}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="table-y">Y (cm)</FieldLabel>
                      <Input
                        id="table-y"
                        min={0}
                        onChange={(event) => setTableYCm(Number(event.target.value))}
                        required
                        type="number"
                        value={tableYCm}
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={tableAccessible}
                      onChange={(event) => setTableAccessible(event.target.checked)}
                      type="checkbox"
                    />
                    Mesa accesible
                  </label>
                  <FormFeedback pendingLabel="Añadiendo mesa…" state={feedback.state} />
                  <Button disabled={feedback.pending} type="submit">
                    Añadir mesa
                  </Button>
                </form>
              )}
              <div className="mt-6 border-t pt-6">
                <Field>
                  <FieldLabel htmlFor="version-name">Guardar como versión</FieldLabel>
                  <Input
                    id="version-name"
                    onChange={(event) => setVersionName(event.target.value)}
                    required
                    value={versionName}
                  />
                </Field>
                <Field className="mt-3">
                  <FieldLabel htmlFor="version-activation">Activar desde</FieldLabel>
                  <Input
                    id="version-activation"
                    onChange={(event) => setVersionActivation(event.target.value)}
                    required
                    type="datetime-local"
                    value={versionActivation}
                  />
                </Field>
                <Field className="mt-3">
                  <FieldLabel htmlFor="version-deactivation">Activar hasta (opcional)</FieldLabel>
                  <Input
                    id="version-deactivation"
                    onChange={(event) => setVersionDeactivation(event.target.value)}
                    type="datetime-local"
                    value={versionDeactivation}
                  />
                </Field>
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
                  <Button
                    disabled={feedback.pending}
                    onClick={() => void saveVersion()}
                    type="button"
                  >
                    Guardar
                  </Button>
                  <Button onClick={exportTemplate} type="button" variant="outline">
                    Exportar plantilla
                  </Button>
                  <Button
                    onClick={() => templateInputRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    Importar plantilla
                  </Button>
                  <input
                    accept="application/json,.json,image/*,application/pdf"
                    className="hidden"
                    onChange={importTemplate}
                    ref={templateInputRef}
                    type="file"
                  />
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
                autoFocus
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
            <DialogTitle>Añadir al plano</DialogTitle>
            <DialogDescription>
              Elige un elemento para colocarlo en el punto seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['wall', 'Pared', Square],
                ['door', 'Puerta', DoorOpen],
                ['bar', 'Barra', PanelTop],
                ['stairs', 'Escalera', Footprints],
                ['plant', 'Planta', LayoutGrid],
                ['pillar', 'Pilar', Grid2X2],
                ['bathroom', 'Baño', Square],
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
