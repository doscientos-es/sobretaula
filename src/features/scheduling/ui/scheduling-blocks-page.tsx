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
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
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
            <Select
              aria-label="Tipo"
              onSelectionChange={(key) => setBlockType(String(key))}
              selectedKey={blockType}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  <SelectItem id="closure">Cierre</SelectItem>
                  <SelectItem id="vacation">Vacaciones</SelectItem>
                  <SelectItem id="private_event">Evento privado</SelectItem>
                  <SelectItem id="maintenance">Mantenimiento</SelectItem>
                  <SelectItem id="last_minute">Última hora</SelectItem>
                </SelectList>
              </SelectContent>
            </Select>
            <Select
              aria-label="Área"
              onSelectionChange={(key) => setAreaId(String(key) === 'all' ? '' : String(key))}
              selectedKey={areaId || 'all'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  <SelectItem id="all">Todo el local</SelectItem>
                  {areas.map((area) => (
                    <SelectItem id={area.id} key={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
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
                  <Button
                    className="text-destructive ml-2 underline"
                    onClick={() =>
                      void deleteSchedulingBlock({
                        data: { tenantId, venueId, blockId: block.id },
                      }).then(load)
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Eliminar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
