import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@doscientos/ui'
import { useState } from 'react'

import type { EventLayoutTemplate } from '../domain/event-layout-template'
import type { FloorPlanArea } from '../domain/floor-plan'

interface EventTemplateValues {
  activeFrom: string
  activeTo: string
  editingEventId?: string
  name: string
}

export function FloorPlanEventTemplates({
  activeArea,
  activeVersion,
  onDelete,
  onSave,
  templates,
}: {
  activeArea: FloorPlanArea | undefined
  activeVersion: { widthCm: number; heightCm: number } | undefined
  onDelete: (template: EventLayoutTemplate) => Promise<void>
  onSave: (values: EventTemplateValues) => Promise<void>
  templates: readonly EventLayoutTemplate[]
}) {
  const [eventName, setEventName] = useState('')
  const [eventFrom, setEventFrom] = useState('')
  const [eventTo, setEventTo] = useState('')
  const [editingEventId, setEditingEventId] = useState<string>()
  const [pending, setPending] = useState(false)

  async function save() {
    if (!eventName.trim() || !eventFrom) return
    setPending(true)
    try {
      await onSave({
        activeFrom: eventFrom,
        activeTo: eventTo,
        ...(editingEventId ? { editingEventId } : {}),
        name: eventName,
      })
      setEventName('')
      setEventFrom('')
      setEventTo('')
      setEditingEventId(undefined)
    } finally {
      setPending(false)
    }
  }

  function edit(template: EventLayoutTemplate) {
    setEditingEventId(template.id)
    setEventName(template.name)
    setEventFrom(template.activeFrom.slice(0, 16))
    setEventTo(template.activeTo?.slice(0, 16) ?? '')
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  async function remove(template: EventLayoutTemplate) {
    if (!window.confirm(`¿Borrar la plantilla «${template.name}»?`)) return
    setPending(true)
    try {
      await onDelete(template)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plantillas de evento</CardTitle>
            <CardDescription>Servicios especiales programados por zona.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div className="border-border rounded-lg border p-3" key={template.id}>
                <p className="font-medium">{template.name}</p>
                <p className="text-muted-foreground text-xs">
                  Desde {new Date(template.activeFrom).toLocaleString('es-ES')}
                  {template.activeTo
                    ? ` · hasta ${new Date(template.activeTo).toLocaleString('es-ES')}`
                    : ''}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {template.areaIds.length} zonas afectadas
                </p>
                <Button
                  className="mt-2"
                  disabled={pending}
                  onClick={() => void remove(template)}
                  type="button"
                  variant="outline"
                >
                  Borrar
                </Button>
                <Button
                  className="mt-2 ml-2"
                  onClick={() => edit(template)}
                  type="button"
                  variant="outline"
                >
                  Editar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {activeVersion && activeArea && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingEventId ? 'Editar plantilla de evento' : 'Crear plantilla de evento'}
            </CardTitle>
            <CardDescription>Guarda el layout actual para {activeArea.name}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Input
              aria-label="Nombre del evento"
              onChange={(event) => setEventName(event.target.value)}
              placeholder="Nombre"
              value={eventName}
            />
            <Input
              aria-label="Inicio del evento"
              onChange={(event) => setEventFrom(event.target.value)}
              type="datetime-local"
              value={eventFrom}
            />
            <Input
              aria-label="Fin del evento"
              onChange={(event) => setEventTo(event.target.value)}
              type="datetime-local"
              value={eventTo}
            />
            <Button disabled={pending} onClick={() => void save()} type="button">
              {editingEventId ? 'Guardar cambios' : 'Guardar evento'}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}

export type { EventTemplateValues }
