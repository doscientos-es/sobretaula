import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import {
  createSchedulingBlock,
  deleteSchedulingBlock,
  getSchedulingBlocks,
  getSchedulingAreas,
  type SchedulingArea,
  type SchedulingBlock,
} from '../application/blocks'
export function SchedulingBlocksPage({ tenantId, venueId }: { tenantId: string; venueId: string }) {
  const [blocks, setBlocks] = useState<SchedulingBlock[]>([])
  const [title, setTitle] = useState('')
  const [blockType, setBlockType] = useState('closure')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [areas, setAreas] = useState<SchedulingArea[]>([])
  const [areaId, setAreaId] = useState('')
  const load = useCallback(
    () => void getSchedulingBlocks({ data: { tenantId, venueId } }).then(setBlocks),
    [tenantId, venueId],
  )
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    void getSchedulingAreas({ data: { tenantId, venueId } }).then(setAreas)
  }, [tenantId, venueId])
  async function submit(event: FormEvent) {
    event.preventDefault()
    await createSchedulingBlock({
      data: {
        tenantId,
        venueId,
        areaId: areaId || null,
        blockType: blockType as
          | 'closure'
          | 'vacation'
          | 'private_event'
          | 'maintenance'
          | 'last_minute',
        title,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        visibleOnline: true,
      },
    })
    setTitle('')
    load()
  }
  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Bloques y cierres</PageHeaderTitle>
        <PageHeaderDescription>
          Gestiona excepciones sin modificar los turnos habituales.
        </PageHeaderDescription>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Nuevo bloqueo</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              void submit(event)
            }}
          >
            <Input
              aria-label="Título"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Evento privado"
              required
              value={title}
            />
            <select
              aria-label="Tipo"
              className="border-border rounded-md border px-2"
              onChange={(e) => setBlockType(e.target.value)}
              value={blockType}
            >
              <option value="closure">Cierre</option>
              <option value="vacation">Vacaciones</option>
              <option value="private_event">Evento privado</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="last_minute">Última hora</option>
            </select>
            <select
              aria-label="Área"
              className="border-border rounded-md border px-2"
              onChange={(e) => setAreaId(e.target.value)}
              value={areaId}
            >
              <option value="">Todo el local</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            <Input
              aria-label="Inicio"
              onChange={(e) => setStartsAt(e.target.value)}
              required
              type="datetime-local"
              value={startsAt}
            />
            <Input
              aria-label="Fin"
              onChange={(e) => setEndsAt(e.target.value)}
              required
              type="datetime-local"
              value={endsAt}
            />
            <Button type="submit">Crear bloqueo</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Próximos bloques</CardTitle>
          <CardDescription>{blocks.length} registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-border divide-y">
            {blocks.map((block) => (
              <li className="flex flex-wrap justify-between gap-2 py-3" key={block.id}>
                <span className="font-medium">{block.title}</span>
                <span className="text-muted-foreground text-sm">
                  {block.blockType} · {new Date(block.startsAt).toLocaleString()} –{' '}
                  {new Date(block.endsAt).toLocaleString()}
                  <button
                    className="text-destructive ml-2 underline"
                    onClick={() =>
                      void deleteSchedulingBlock({
                        data: { tenantId, venueId, blockId: block.id },
                      }).then(load)
                    }
                    type="button"
                  >
                    Eliminar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
