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
import { useEffect, useState } from 'react'

import {
  addGuestNote,
  getGuestTags,
  searchGuests,
  toggleGuestTag,
  type GuestSummary,
} from '../application/guests'

export function GuestsPage({ tenantId, venueId }: { tenantId: string; venueId: string }) {
  const [query, setQuery] = useState('')
  const [guests, setGuests] = useState<GuestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<Array<{ id: string; label: string }>>([])
  useEffect(() => {
    void getGuestTags({ data: { tenantId } }).then(setTags)
  }, [tenantId])
  useEffect(() => {
    let active = true
    void searchGuests({ data: { tenantId, venueId, query } })
      .then((result) => {
        if (active) setGuests(result)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, tenantId, venueId])
  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Clientes</PageHeaderTitle>
        <PageHeaderDescription>
          Consulta el historial y las preferencias de tus comensales.
        </PageHeaderDescription>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Directorio</CardTitle>
          <CardDescription>Busca por nombre, teléfono o email.</CardDescription>
          <Input
            aria-label="Buscar clientes"
            onChange={(event) => {
              setLoading(true)
              setQuery(event.target.value)
            }}
            placeholder="Buscar cliente…"
            value={query}
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Cargando clientes…</p>
          ) : guests.length ? (
            <ul className="divide-border divide-y">
              {guests.map((guest) => (
                <li className="py-3" key={guest.id}>
                  <button
                    className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                    onClick={() => setSelected(selected === guest.id ? null : guest.id)}
                    type="button"
                  >
                    <div>
                      <p className="font-medium">{guest.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {guest.phone ?? guest.email ?? 'Sin contacto'}
                        {guest.notes ? ` · ${guest.notes}` : ''}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-sm">
                      {guest.reservations} reservas · {guest.visits} visitas ·{' '}
                      {(guest.spendCents / 100).toFixed(2)} €
                    </span>
                  </button>
                  {selected === guest.id ? (
                    <div className="bg-muted/30 mt-3 grid gap-3 rounded-md p-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => {
                          const active = guest.tags.includes(tag.label)
                          return (
                            <button
                              className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                              key={tag.id}
                              onClick={() =>
                                void toggleGuestTag({
                                  data: { tenantId, guestId: guest.id, tagId: tag.id },
                                }).then(
                                  () =>
                                    void searchGuests({ data: { tenantId, venueId, query } }).then(
                                      setGuests,
                                    ),
                                )
                              }
                              type="button"
                            >
                              {tag.label}
                            </button>
                          )
                        })}
                      </div>
                      {guest.history.length ? (
                        <div className="grid gap-1 text-xs">
                          {guest.history.slice(0, 5).map((entry) => (
                            <p className="text-muted-foreground" key={entry.createdAt}>
                              <span className="text-foreground font-medium">{entry.category}</span>{' '}
                              · {entry.body}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Input
                          aria-label={`Nueva nota para ${guest.name}`}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Añadir nota interna…"
                          value={note}
                        />
                        <Button
                          disabled={!note.trim()}
                          onClick={() =>
                            void addGuestNote({
                              data: { tenantId, guestId: guest.id, body: note },
                            }).then(() => {
                              setNote('')
                            })
                          }
                          size="sm"
                          type="button"
                        >
                          Guardar nota
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No hay clientes que coincidan.</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
