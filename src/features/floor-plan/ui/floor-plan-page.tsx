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
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'

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
import type { FloorPlanData, FloorPlanElement, PlanElementKind } from '../domain/floor-plan'
import {
  DEFAULT_GRID_SIZE_CM,
  findPlacementCollisions,
  isPlacementWithinBounds,
  movePlacement,
} from '../domain/geometry'

export function FloorPlanPage({ data, tenantId }: { data: FloorPlanData; tenantId: string }) {
  const feedback = useFormFeedback()
  const [venueName, setVenueName] = useState('Mi restaurante')
  const [areaName, setAreaName] = useState('Sala principal')
  const [widthCm, setWidthCm] = useState(800)
  const [heightCm, setHeightCm] = useState(600)
  const [tableCode, setTableCode] = useState('1')
  const [tableSeats, setTableSeats] = useState(4)
  const [tableXCm, setTableXCm] = useState(50)
  const [tableYCm, setTableYCm] = useState(50)
  const [versionName, setVersionName] = useState('Nueva versión')
  const [versionActivation, setVersionActivation] = useState('')
  const [draggingTableId, setDraggingTableId] = useState<string>()
  const activeVersion = data.versions[0]
  const activeArea = activeVersion
    ? data.areas.find((area) => area.id === activeVersion.areaId)
    : undefined
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

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()

    try {
      await createInitialFloorPlan({
        data: { areaName, heightCm, tenantId, venueName, widthCm },
      })
      window.location.reload()
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
          venueId: activeArea.venueId,
          versionId: activeVersion.id,
          widthCm: 100,
          xCm: tableXCm,
          yCm: tableYCm,
        },
      })
      window.location.reload()
    } catch {
      feedback.setError('La mesa queda fuera del plano, se solapa o ya existe ese código.')
    }
  }

  function changePlacement(id: string, xCm: number, yCm: number) {
    if (!activeVersion) return
    const updated = placements.map((placement) => {
      if (placement.id !== id) return placement
      return { ...placement, ...movePlacement(placement, { xCm, yCm }) }
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

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const distance = event.shiftKey ? 5 : DEFAULT_GRID_SIZE_CM
    const current = placements.find((placement) => placement.id === id)
    if (!current) return
    const displacement = {
      ArrowDown: { x: 0, y: distance },
      ArrowLeft: { x: -distance, y: 0 },
      ArrowRight: { x: distance, y: 0 },
      ArrowUp: { x: 0, y: -distance },
    }[event.key]
    if (!displacement) return
    event.preventDefault()
    changePlacement(id, current.xCm + displacement.x, current.yCm + displacement.y)
  }

  function finishDrag(event: PointerEvent<SVGSVGElement>) {
    if (!activeVersion || !draggingTableId) return
    const rectangle = event.currentTarget.getBoundingClientRect()
    changePlacement(
      draggingTableId,
      ((event.clientX - rectangle.left) / rectangle.width) * activeVersion.widthCm,
      ((event.clientY - rectangle.top) / rectangle.height) * activeVersion.heightCm,
    )
    setDraggingTableId(undefined)
  }

  function addElement(kind: PlanElementKind) {
    if (!activeVersion) return
    const element: FloorPlanElement = {
      floorPlanVersionId: activeVersion.id,
      heightCm: kind === 'wall' ? 25 : 100,
      id: crypto.randomUUID(),
      kind,
      label: kind === 'wall' ? 'Pared' : kind === 'door' ? 'Puerta' : 'Barra',
      rotationDeg: 0,
      widthCm: kind === 'wall' ? 250 : 100,
      xCm: 0,
      yCm: 0,
    }
    setHistory((current) =>
      commitEditorHistory(current, { ...current.present, elements: [...elements, element] }),
    )
  }

  async function saveVersion() {
    if (!activeVersion) return
    const activationDate = new Date(versionActivation)
    if (!versionActivation || Number.isNaN(activationDate.getTime())) {
      feedback.setError('Indica una fecha y hora de activación válida.')
      return
    }
    const activeFrom = activationDate.toISOString()
    feedback.setPending()
    try {
      await saveFloorPlanVersion({
        data: {
          activeFrom,
          elements,
          name: versionName,
          placements,
          sourceVersionId: activeVersion.id,
          tenantId,
        },
      })
      window.location.reload()
    } catch {
      feedback.setError('No se ha podido guardar la versión del plano.')
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Plano de sala</PageHeaderTitle>
      </PageHeader>
      {!activeVersion ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Crea tu primer plano</CardTitle>
            <CardDescription>
              Define el local y su primera área. Después podrás colocar mesas y guardar nuevas
              versiones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => void createPlan(event)}
            >
              <Field>
                <FieldLabel htmlFor="venue-name">Nombre del local</FieldLabel>
                <Input
                  id="venue-name"
                  onChange={(event) => setVenueName(event.target.value)}
                  required
                  value={venueName}
                />
              </Field>
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
              <div className="sm:col-span-2">
                <FormFeedback pendingLabel="Creando plano…" state={feedback.state} />
                <Button className="mt-2" disabled={feedback.pending} type="submit">
                  Crear plano
                </Button>
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
            </CardHeader>
            <CardContent>
              <svg
                aria-label={`Plano ${activeVersion.name}`}
                className="border-border bg-muted/30 h-auto w-full rounded-md border"
                onPointerCancel={() => setDraggingTableId(undefined)}
                onPointerUp={finishDrag}
                viewBox={`0 0 ${activeVersion.widthCm} ${activeVersion.heightCm}`}
              >
                <rect
                  fill="transparent"
                  height={activeVersion.heightCm}
                  width={activeVersion.widthCm}
                />
                {elements.map((element) => (
                  <g key={element.id} aria-hidden="true">
                    <rect
                      fill={
                        element.kind === 'wall' ? 'var(--foreground)' : 'var(--muted-foreground)'
                      }
                      height={element.heightCm}
                      opacity="0.65"
                      rx="8"
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
                  <g key={placement.id} aria-label={`Mesa ${placement.code}`}>
                    <rect
                      fill="var(--primary)"
                      height={placement.heightCm}
                      onPointerDown={() => setDraggingTableId(placement.id)}
                      opacity="0.85"
                      rx="12"
                      transform={`rotate(${placement.rotationDeg} ${placement.xCm} ${placement.yCm})`}
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
                        type="button"
                      >
                        {`Mesa ${placement.code} · ${placement.xCm}, ${placement.yCm}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
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
