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
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

export type FloorPlanPreviewDevice = 'desktop' | 'tablet' | 'mobile'
type FloorPlanSpaceType = 'indoor' | 'covered_terrace' | 'outdoor_terrace' | 'other'

export interface FloorPlanSetupValues {
  areaName: string
  floorNumber: number | null
  heightCm: number
  outdoorOpen: boolean
  spaceType: FloorPlanSpaceType
  widthCm: number
}

export function FloorPlanSetupCard({
  onCreate,
  previewDevice,
  setPreviewDevice,
}: {
  onCreate: (values: FloorPlanSetupValues) => Promise<void>
  previewDevice: FloorPlanPreviewDevice
  setPreviewDevice: (device: FloorPlanPreviewDevice) => void
}) {
  const feedback = useFormFeedback()
  const [areaName, setAreaName] = useState('Sala principal')
  const [widthCm, setWidthCm] = useState(800)
  const [heightCm, setHeightCm] = useState(600)
  const [floorNumber, setFloorNumber] = useState<number | null>(0)
  const [spaceType, setSpaceType] = useState<FloorPlanSpaceType>('indoor')
  const [outdoorOpen, setOutdoorOpen] = useState(true)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return
    feedback.setPending()
    try {
      await onCreate({ areaName, floorNumber, heightCm, outdoorOpen, spaceType, widthCm })
    } catch {
      feedback.setError('No se ha podido crear el plano. Revisa los datos e inténtalo de nuevo.')
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Crea tu primer plano</CardTitle>
        <CardDescription>
          Define la primera área del local. Después podrás colocar mesas y guardar nuevas versiones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
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
              onChange={(event) => setSpaceType(event.target.value as FloorPlanSpaceType)}
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
  )
}
