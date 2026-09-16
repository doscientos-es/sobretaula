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

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

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
  const [loadingBlocks, setLoadingBlocks] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [title, setTitle] = useState('')
  const [blockType, setBlockType] = useState('closure')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [areas, setAreas] = useState<SchedulingArea[]>([])
  const [areaId, setAreaId] = useState('')
  const [pending, setPending] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoadingBlocks(true)
    setLoadError(false)
    try {
      setBlocks(await getSchedulingBlocks({ data: { tenantId, venueId } }))
    } catch {
      setLoadError(true)
      setFeedback('No se han podido cargar los bloqueos.')
    } finally {
      setLoadingBlocks(false)
    }
  }, [tenantId, venueId])
  useAsyncEffect(load, [load])
  useEffect(() => {
    void getSchedulingAreas({ data: { tenantId, venueId } })
      .then(setAreas)
      .catch(() => setFeedback('No se han podido cargar las zonas del local.'))
  }, [tenantId, venueId])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (!startsAt || !endsAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFeedback('Indica una fecha de inicio y fin válidas.')
      return
    }
    if (end <= start) {
      setFeedback('La fecha de fin debe ser posterior al inicio.')
      return
    }
    setPending(true)
    setFeedback(null)
    try {
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
          title: title.trim(),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          visibleOnline: true,
        },
      })
      setTitle('')
      setFeedback('Bloqueo creado.')
      await load()
    } catch {
      setFeedback('No se ha podido crear el bloqueo.')
    } finally {
      setPending(false)
    }
  }
  async function remove(blockId: string) {
    if (deletingId) return
    setDeletingId(blockId)
    setFeedback(null)
    try {
      await deleteSchedulingBlock({ data: { tenantId, venueId, blockId } })
      setFeedback('Bloqueo eliminado.')
      await load()
    } catch {
      setFeedback('No se ha podido eliminar el bloqueo. Inténtalo de nuevo.')
    } finally {
      setDeletingId(null)
      setPendingDeleteId(null)
    }
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
            <Button disabled={pending} type="submit">
              {pending ? 'Creando…' : 'Crear bloqueo'}
            </Button>
          </form>
          {feedback && (
            <output aria-live="polite" className="mt-3 block text-sm">
              {feedback}
            </output>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Próximos bloques</CardTitle>
          <CardDescription>{blocks.length} registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBlocks ? (
            <p aria-busy="true" className="text-muted-foreground py-4 text-sm">
              Cargando bloqueos…
            </p>
          ) : loadError ? (
            <div className="space-y-2 py-4">
              <p className="text-destructive text-sm" role="alert">
                No se han podido cargar los bloqueos.
              </p>
              <Button
                onClick={() => {
                  setFeedback(null)
                  void load()
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Reintentar
              </Button>
            </div>
          ) : blocks.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              No hay bloqueos programados. Crea uno arriba para cerrar el local o una zona.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {blocks.map((block) => (
                <li className="flex flex-wrap justify-between gap-2 py-3" key={block.id}>
                  <span className="font-medium">{block.title}</span>
                  <span className="text-muted-foreground text-sm">
                    {block.blockType} · {new Date(block.startsAt).toLocaleString()} –{' '}
                    {new Date(block.endsAt).toLocaleString()}
                    {pendingDeleteId === block.id ? (
                      <span className="ml-2 inline-flex items-center gap-2">
                        <span className="text-muted-foreground">¿Eliminar?</span>
                        <Button
                          disabled={deletingId !== null}
                          onClick={() => void remove(block.id)}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          {deletingId === block.id ? 'Eliminando…' : 'Confirmar'}
                        </Button>
                        <Button
                          disabled={deletingId !== null}
                          onClick={() => setPendingDeleteId(null)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          No
                        </Button>
                      </span>
                    ) : (
                      <Button
                        className="text-destructive ml-2 underline"
                        onClick={() => setPendingDeleteId(block.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Eliminar
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
