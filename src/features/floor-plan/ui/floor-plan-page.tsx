import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  createFloorPlanTable,
  createInitialFloorPlan,
  createTableGroupPreset,
  saveFloorPlanVersion,
} from '../application/floor-plan'
import {
  commitEditorHistory,
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
} from '../domain/editor-history'
import {
  findVersionScheduleConflicts,
  describeSpaceType,
  selectFloorPlanVersion,
  type FloorPlanData,
  type FloorPlanElement,
  type PlanElementKind,
} from '../domain/floor-plan'
import {
  DEFAULT_GRID_SIZE_CM,
  findPlacementCollisions,
  findBlockedAccesses,
  isPlacementWithinBounds,
  movePlacement,
  validateLayout,
} from '../domain/geometry'

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
  const [areaName, setAreaName] = useState('Sala principal')
  const [widthCm, setWidthCm] = useState(800)
  const [heightCm, setHeightCm] = useState(600)
  const [floorNumber, setFloorNumber] = useState<number | null>(0)
  const [spaceType, setSpaceType] = useState<
    'indoor' | 'covered_terrace' | 'outdoor_terrace' | 'other'
  >('indoor')
  const [outdoorOpen, setOutdoorOpen] = useState(true)
  const [tableCode, setTableCode] = useState('1')
  const [tableSeats, setTableSeats] = useState(4)
  const [tableXCm, setTableXCm] = useState(50)
  const [tableYCm, setTableYCm] = useState(50)
  const [presetName, setPresetName] = useState('Combinación')
  const [presetMaxSeats, setPresetMaxSeats] = useState(8)
  const [versionName, setVersionName] = useState('Nueva versión')
  const [versionActivation, setVersionActivation] = useState('')
  const [versionDeactivation, setVersionDeactivation] = useState('')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [draggingTableId, setDraggingTableId] = useState<string>()
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lockedIds, setLockedIds] = useState<string[]>([])
  const [zoom, setZoom] = useState(1)
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE_CM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panPointer = useRef<{ id: number; x: number; y: number } | undefined>(undefined)
  const [selectedAreaId, setSelectedAreaId] = useState(data.areas[0]?.id)
  useEffect(() => {
    if (selectedAreaId && data.areas.some((area) => area.id === selectedAreaId)) return
    setSelectedAreaId(data.areas[0]?.id)
  }, [data.areas, selectedAreaId])
  const activeArea = data.areas.find((area) => area.id === selectedAreaId) ?? data.areas[0]
  const activePresets = data.tableGroupPresets.filter((preset) => preset.areaId === activeArea?.id)
  const activeVersion = activeArea
    ? (selectFloorPlanVersion(data.versions, activeArea.id) ??
      data.versions.find((version) => version.areaId === activeArea.id))
    : undefined
  const lockStorageKey = activeVersion
    ? `sobretaula:floor-plan-locks:${activeVersion.id}`
    : undefined
  const lockHydrated = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!lockStorageKey || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(lockStorageKey)
      const parsed = raw ? JSON.parse(raw) : []
      setLockedIds(
        Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [],
      )
    } catch {
      setLockedIds([])
    }
    lockHydrated.current = lockStorageKey
  }, [lockStorageKey])
  useEffect(() => {
    if (!lockStorageKey || lockHydrated.current !== lockStorageKey || typeof window === 'undefined')
      return
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
  const layoutIssues = activeVersion ? validateLayout(placements, activeVersion) : []
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
  const viewBox = activeVersion
    ? `${Math.max(0, Math.min(activeVersion.widthCm * (1 - 1 / zoom), (activeVersion.widthCm * (1 - 1 / zoom)) / 2 + pan.x)).toFixed(2)} ${Math.max(0, Math.min(activeVersion.heightCm * (1 - 1 / zoom), (activeVersion.heightCm * (1 - 1 / zoom)) / 2 + pan.y)).toFixed(2)} ${(activeVersion.widthCm / zoom).toFixed(2)} ${(activeVersion.heightCm / zoom).toFixed(2)}`
    : undefined

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()

    try {
      await createInitialFloorPlan({
        data: {
          areaName,
          floorNumber,
          heightCm,
          outdoorOpen,
          spaceType,
          tenantId,
          venueId,
          widthCm,
        },
      })
      reload()
    } catch {
      feedback.setError('No se ha podido crear el plano. Revisa los datos e inténtalo de nuevo.')
    }
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
    setLockedIds([])
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

  function finishDrag(event: PointerEvent<SVGSVGElement>) {
    if (!activeVersion || !draggingTableId) return
    const svg = event.currentTarget
    const transform = svg.getScreenCTM()
    if (!transform) {
      setDraggingTableId(undefined)
      return
    }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const planPoint = point.matrixTransform(transform.inverse())
    changePlacement(draggingTableId, planPoint.x, planPoint.y)
    setDraggingTableId(undefined)
  }

  function addElement(kind: PlanElementKind) {
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
      xCm: 0,
      yCm: 0,
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
          placements,
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

  async function savePreset() {
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
          tableIds: selectedIds.filter((id) => placements.some((table) => table.id === id)),
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Combinación guardada.')
      await reload()
    } catch (error) {
      feedback.setError(error instanceof Error ? error.message : 'No se pudo guardar la combinación.')
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
      {!activeVersion ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Crea tu primer plano</CardTitle>
            <CardDescription>
              Define la primera área del local. Después podrás colocar mesas y guardar nuevas
              versiones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => void createPlan(event)}
            >
              <Field>
                <FieldLabel htmlFor="area-name">Área</FieldLabel>
                <Input
                  id="area-name"
                  onChange={(event) => setAreaName(event.target.value)}
                  required
                  value={areaName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="width-cm">Ancho (cm)</FieldLabel>
                <Input
                  id="width-cm"
                  min={100}
                  onChange={(event) => setWidthCm(Number(event.target.value))}
                  required
                  type="number"
                  value={widthCm}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="height-cm">Alto (cm)</FieldLabel>
                <Input
                  id="height-cm"
                  min={100}
                  onChange={(event) => setHeightCm(Number(event.target.value))}
                  required
                  type="number"
                  value={heightCm}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="floor-number">Planta</FieldLabel>
                <Input
                  id="floor-number"
                  onChange={(event) =>
                    setFloorNumber(event.target.value === '' ? null : Number(event.target.value))
                  }
                  type="number"
                  value={floorNumber ?? ''}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="space-type">Tipo de zona</FieldLabel>
                <select
                  className="border-border rounded-md border px-2"
                  id="space-type"
                  onChange={(event) => setSpaceType(event.target.value as typeof spaceType)}
                  value={spaceType}
                >
                  <option value="indoor">Interior</option>
                  <option value="covered_terrace">Terraza cubierta</option>
                  <option value="outdoor_terrace">Terraza exterior</option>
                  <option value="other">Otra zona</option>
                </select>
              </Field>
              {spaceType !== 'indoor' && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    checked={outdoorOpen}
                    onChange={(event) => setOutdoorOpen(event.target.checked)}
                    type="checkbox"
                  />
                  Terraza abierta para operar
                </label>
              )}
              <div className="sm:col-span-2">
                <FormFeedback pendingLabel="Creando plano…" state={feedback.state} />
                <Button className="mt-2" disabled={feedback.pending} type="submit">
                  Crear plano
                </Button>
              </div>
              <div
                className="flex flex-wrap items-center gap-2 pt-2"
                aria-label="Previsualización responsive"
              >
                <span className="text-muted-foreground text-sm">Previsualizar:</span>
                {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
                  <Button
                    key={device}
                    aria-pressed={previewDevice === device}
                    onClick={() => setPreviewDevice(device)}
                    size="sm"
                    type="button"
                    variant={previewDevice === device ? 'default' : 'outline'}
                  >
                    {device === 'desktop' ? 'Escritorio' : device === 'tablet' ? 'Tablet' : 'Móvil'}
                  </Button>
                ))}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Card>
            <CardHeader>
              <CardTitle>{activeVersion.name}</CardTitle>
              <CardDescription>
                {activeVersion.widthCm / 100} m × {activeVersion.heightCm / 100} m ·{' '}
                {placements.length} mesas
              </CardDescription>
              <div className="flex items-center gap-2 pt-2" aria-label="Controles de zoom">
                <Button
                  aria-label="Alejar plano"
                  disabled={zoom <= 1}
                  onClick={() => setZoom((current) => Math.max(1, current - 0.25))}
                  type="button"
                  variant="outline"
                >
                  −
                </Button>
                <output className="text-muted-foreground min-w-12 text-center text-sm">
                  {Math.round(zoom * 100)}%
                </output>
                <Button
                  aria-label="Acercar plano"
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
                    onChange={(event) => setGridSize(Number(event.target.value))}
                    value={gridSize}
                  >
                    <option value={25}>25 cm</option>
                    <option value={50}>50 cm</option>
                    <option value={100}>1 m</option>
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
                  {alignmentGuides.some((guide) => guide.axis === 'y')
                    ? 'alineación horizontal'
                    : ''}
                </p>
              )}
              {data.areas.length > 1 && (
                <Field className="pt-2">
                  <FieldLabel htmlFor="floor-plan-area">Zona a editar</FieldLabel>
                  <select
                    aria-label="Zona a editar"
                    className="border-border rounded-md border px-2 py-1 text-sm"
                    id="floor-plan-area"
                    onChange={(event) => switchArea(event.target.value)}
                    value={activeArea?.id ?? ''}
                  >
                    {data.areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name} ·{' '}
                        {area.floorNumber === 0
                          ? 'Planta baja'
                          : area.floorNumber === null || area.floorNumber === undefined
                            ? 'Sin planta'
                            : `Planta ${area.floorNumber}`}{' '}
                        · {describeSpaceType(area.spaceType)}
                      </option>
                    ))}
                  </select>
                </Field>
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
                      <li
                        key={`${issue.code}-${issue.placementId}-${issue.relatedPlacementId ?? ''}`}
                      >
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
                className={`mx-auto transition-[max-width] ${previewDevice === 'mobile' ? 'max-w-[390px]' : previewDevice === 'tablet' ? 'max-w-[768px]' : 'max-w-none'}`}
              >
                <svg
                  aria-label={`Plano ${activeVersion.name}`}
                  className="border-border bg-muted/30 h-auto w-full rounded-xl border shadow-inner"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      setSelectedId(undefined)
                      setSelectedIds([])
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setSelectedId(undefined)
                      setSelectedIds([])
                    } else if (event.key === 'Delete' || event.key === 'Backspace') {
                      if (selectedId) {
                        event.preventDefault()
                        removeSelected()
                      }
                    } else if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key.toLowerCase() === 'a'
                    ) {
                      event.preventDefault()
                      const ids = [...elements, ...placements].map((item) => item.id)
                      setSelectedIds(ids)
                      setSelectedId(ids[0])
                    } else if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key.toLowerCase() === 'd'
                    ) {
                      if (selectedId) {
                        event.preventDefault()
                        duplicateSelected()
                      }
                    } else if (
                      !event.ctrlKey &&
                      !event.metaKey &&
                      event.key.toLowerCase() === 'r'
                    ) {
                      const selected =
                        placements.find((item) => item.id === selectedId) ??
                        elements.find((item) => item.id === selectedId)
                      if (selected) {
                        event.preventDefault()
                        updateSelected({ rotationDeg: (selected.rotationDeg + 90) % 360 })
                      }
                    } else if (event.key === '+' || event.key === '=') {
                      event.preventDefault()
                      setZoom((current) => Math.min(3, current + 0.25))
                    } else if (event.key === '-') {
                      event.preventDefault()
                      setZoom((current) => Math.max(1, current - 0.25))
                    } else if (event.key === '0') {
                      event.preventDefault()
                      setZoom(1)
                      setPan({ x: 0, y: 0 })
                    } else if (
                      event.altKey &&
                      ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)
                    ) {
                      event.preventDefault()
                      const distance = 100 / zoom
                      setPan((current) => ({
                        x:
                          current.x +
                          (event.key === 'ArrowRight'
                            ? distance
                            : event.key === 'ArrowLeft'
                              ? -distance
                              : 0),
                        y:
                          current.y +
                          (event.key === 'ArrowDown'
                            ? distance
                            : event.key === 'ArrowUp'
                              ? -distance
                              : 0),
                      }))
                    }
                  }}
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
                        ((event.clientY - start.y) / bounds.height) *
                          (activeVersion.heightCm / zoom),
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
                  role="application"
                  tabIndex={0}
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
                    width={activeVersion.widthCm}
                  />
                  {(() => {
                    const selected =
                      placements.find((item) => item.id === selectedId) ??
                      elements.find((item) => item.id === selectedId)
                    if (!selected) return null
                    return (
                      <g
                        aria-hidden="true"
                        pointerEvents="none"
                        stroke="var(--ring)"
                        strokeDasharray="12 10"
                        strokeWidth="3"
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
                    )
                  })()}
                  {alignmentGuides.map((guide, index) =>
                    guide.axis === 'x' ? (
                      <line
                        key={`guide-${index}`}
                        stroke="var(--destructive)"
                        strokeDasharray="8 8"
                        strokeWidth="2"
                        x1={guide.value}
                        x2={guide.value}
                        y1={0}
                        y2={activeVersion.heightCm}
                      />
                    ) : (
                      <line
                        key={`guide-${index}`}
                        stroke="var(--destructive)"
                        strokeDasharray="8 8"
                        strokeWidth="2"
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
                      aria-label={`${element.label ?? `Elemento ${element.kind}`}${lockedIds.includes(element.id) ? ' (bloqueado)' : ''}`}
                      className="cursor-pointer"
                      onClick={(event) => selectItem(element.id, event.ctrlKey || event.metaKey)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          selectItem(element.id, event.ctrlKey || event.metaKey)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <rect
                        fill={
                          element.kind === 'wall' ? 'var(--foreground)' : 'var(--muted-foreground)'
                        }
                        height={element.heightCm}
                        opacity={lockedIds.includes(element.id) ? 0.48 : 0.65}
                        rx="8"
                        stroke={selectedIds.includes(element.id) ? 'var(--ring)' : 'transparent'}
                        strokeWidth={selectedIds.includes(element.id) ? 8 : 0}
                        transform={`rotate(${element.rotationDeg} ${element.xCm + element.widthCm / 2} ${element.yCm + element.heightCm / 2})`}
                        width={element.widthCm}
                        x={element.xCm}
                        y={element.yCm}
                      />
                      {element.label && (
                        <text fontSize="20" x={element.xCm + 8} y={element.yCm + 28}>
                          {element.label}
                        </text>
                      )}
                    </g>
                  ))}
                  {placements.map((placement) => (
                    <g
                      key={placement.id}
                      aria-label={`Mesa ${placement.code}${lockedIds.includes(placement.id) ? ' (bloqueada)' : ''}`}
                      className="cursor-pointer"
                      onClick={(event) => selectItem(placement.id, event.ctrlKey || event.metaKey)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          selectItem(placement.id, event.ctrlKey || event.metaKey)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <rect
                        fill={
                          layoutIssues.some((issue) => issue.placementId === placement.id)
                            ? 'var(--destructive)'
                            : 'var(--primary)'
                        }
                        height={placement.heightCm}
                        onPointerDown={() => {
                          if (!lockedIds.includes(placement.id)) setDraggingTableId(placement.id)
                        }}
                        opacity={lockedIds.includes(placement.id) ? 0.62 : 0.85}
                        rx="12"
                        stroke={selectedIds.includes(placement.id) ? 'var(--ring)' : 'transparent'}
                        strokeWidth={selectedIds.includes(placement.id) ? 8 : 0}
                        transform={`rotate(${placement.rotationDeg} ${placement.xCm + placement.widthCm / 2} ${placement.yCm + placement.heightCm / 2})`}
                        width={placement.widthCm}
                        x={placement.xCm}
                        y={placement.yCm}
                      />
                      <text
                        fill="var(--primary-foreground)"
                        fontSize="32"
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
          <Card>
            <CardHeader>
              <CardTitle>Mesas</CardTitle>
              <CardDescription>Alternativa accesible al plano SVG.</CardDescription>
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
                  <Button onClick={duplicateSelected} type="button">
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
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => addElement('wall')} type="button">
                    Pared
                  </Button>
                  <Button onClick={() => addElement('door')} type="button">
                    Puerta
                  </Button>
                  <Button onClick={() => addElement('bar')} type="button">
                    Barra
                  </Button>
                  <Button onClick={() => addElement('stairs')} type="button">
                    Escalera
                  </Button>
                  <Button onClick={() => addElement('plant')} type="button">
                    Planta
                  </Button>
                  <Button onClick={() => addElement('label')} type="button">
                    Etiqueta
                  </Button>
                  <Button onClick={() => addElement('window')} type="button">
                    Ventana
                  </Button>
                  <Button onClick={() => addElement('other')} type="button">
                    Obstáculo
                  </Button>
                  <Button onClick={() => addElement('pillar')} type="button">
                    Pilar
                  </Button>
                  <Button onClick={() => addElement('bathroom')} type="button">
                    Baño
                  </Button>
                  <Button onClick={() => addElement('kitchen')} type="button">
                    Cocina
                  </Button>
                  <Button onClick={() => addElement('exit')} type="button">
                    Salida
                  </Button>
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
                <div className="mt-4 rounded-lg border p-3">
                  <p className="font-medium">Guardar combinación seleccionada</p>
                  <p className="text-muted-foreground text-xs">{selectedIds.length} mesas seleccionadas</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input aria-label="Nombre de combinación" onChange={(event) => setPresetName(event.target.value)} value={presetName} />
                    <Input aria-label="Capacidad máxima" min={1} onChange={(event) => setPresetMaxSeats(Number(event.target.value))} type="number" value={presetMaxSeats} />
                  </div>
                  <Button className="mt-2" disabled={feedback.pending || selectedIds.length < 2} onClick={() => void savePreset()} type="button">
                    Guardar combinación
                  </Button>
                  {activePresets.length > 0 && <p className="text-muted-foreground mt-2 text-xs">{activePresets.length} combinaciones guardadas en esta zona.</p>}
                </div>
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  )
}
