import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
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
import { useEffect, useState, type DragEvent } from 'react'

import {
  addGuestAllergy,
  addGuestNote,
  addGuestPreference,
  exportGuestContactsCsv,
  getGuestTags,
  importGuestCsv,
  mergeGuests,
  searchGuests,
  updateGuestMarketingConsent,
  toggleGuestTag,
  type GuestSummary,
} from '../application/guests'
import { previewGuestCsv, type GuestImportPreview } from '../domain/guest-import'
import { classifyGuest } from '../domain/guest-segments'

export function GuestsPage({ tenantId, venueId }: { tenantId: string; venueId: string }) {
  const [query, setQuery] = useState('')
  const [guests, setGuests] = useState<GuestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [noteCategory, setNoteCategory] = useState<
    'general' | 'preference' | 'allergy' | 'incident'
  >('general')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [tags, setTags] = useState<Array<{ id: string; label: string }>>([])
  const [attribute, setAttribute] = useState('')
  const [now] = useState(() => Date.now())
  const [csv, setCsv] = useState('')
  const [csvPreview, setCsvPreview] = useState<GuestImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [csvFileName, setCsvFileName] = useState('')
  const [isDraggingCsv, setIsDraggingCsv] = useState(false)
  const [exporting, setExporting] = useState(false)
  async function exportContacts() {
    setExporting(true)
    try {
      const content = await exportGuestContactsCsv({ data: { tenantId } })
      const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `sobretaula-clientes-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setError(null)
    } catch {
      setError('No se ha podido exportar el directorio de clientes.')
    } finally {
      setExporting(false)
    }
  }
  async function loadCsvFile(file: File | undefined) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo CSV no puede superar los 10 MB.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('Selecciona un archivo CSV.')
      return
    }
    try {
      const contents = await file.text()
      setCsv(contents)
      setCsvFileName(file.name)
      setCsvPreview(previewGuestCsv(contents))
    } catch {
      setError('No se ha podido leer el archivo CSV.')
    }
  }
  function dropCsv(event: DragEvent<HTMLInputElement>) {
    event.preventDefault()
    setIsDraggingCsv(false)
    void loadCsvFile(event.dataTransfer.files[0])
  }
  useEffect(() => {
    void getGuestTags({ data: { tenantId } })
      .then(setTags)
      // Tags are an enhancement of the directory, not a prerequisite for
      // loading customers. Do not replace a valid customer result with a
      // global error if this secondary query is unavailable.
      .catch(() => setTags([]))
  }, [reloadToken, tenantId])
  useEffect(() => {
    let active = true
    void searchGuests({ data: { tenantId, venueId, query, page: 1, pageSize: 25 } })
      .then((result) => {
        if (active) setGuests(result.items)
      })
      .catch(() => {
        if (active) {
          setGuests([])
          setError('No se han podido cargar los clientes. Reintenta la búsqueda.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, reloadToken, tenantId, venueId])
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
          <CardTitle>Importar clientes</CardTitle>
          <CardDescription>
            Suelta un CSV o selecciónalo. Se validará automáticamente antes de importar. Columnas:
            nombre; opcionales: telefono, email y consentimiento_marketing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label
            aria-label="Seleccionar archivo CSV de clientes"
            className={cn(
              'grid min-h-24 cursor-pointer place-items-center rounded-lg border-2 border-dashed px-4 py-4 text-center text-sm',
              isDraggingCsv
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/30 hover:border-primary/60',
            )}
            htmlFor="guest-csv-file"
          >
            <span>
              <strong>{csvFileName || 'Suelta el CSV aquí'}</strong>
              <br />
              <span className="text-muted-foreground">
                {csvFileName ? 'Archivo cargado · puedes reemplazarlo' : 'o haz clic para buscarlo'}
              </span>
            </span>
            <input
              accept=".csv,text/csv"
              aria-label="Archivo CSV de clientes"
              className="sr-only"
              id="guest-csv-file"
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDraggingCsv(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setIsDraggingCsv(false)
              }}
              onDragOver={(event) => event.preventDefault()}
              onChange={(event) => void loadCsvFile(event.target.files?.[0])}
              onDrop={dropCsv}
              type="file"
            />
          </label>
          <textarea
            aria-label="CSV de clientes"
            className="min-h-24 w-full rounded-md border px-3 py-2 font-mono text-xs"
            onChange={(event) => {
              setCsv(event.target.value)
              setCsvFileName('')
              setCsvPreview(null)
            }}
            placeholder="nombre;telefono;email;consentimiento_marketing"
            value={csv}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!csv.trim() || importing}
              onClick={() => setCsvPreview(previewGuestCsv(csv))}
              type="button"
              variant="outline"
            >
              Validar CSV
            </Button>
            <Button
              disabled={!csvPreview || csvPreview.errors.length > 0 || importing}
              onClick={() => {
                if (!csvPreview || csvPreview.errors.length) return
                setImporting(true)
                void importGuestCsv({ data: { csv, tenantId } })
                  .then(() => {
                    setCsv('')
                    setCsvFileName('')
                    setCsvPreview(null)
                    setReloadToken((value) => value + 1)
                  })
                  .catch(() => setError('No se han podido importar los clientes.'))
                  .finally(() => setImporting(false))
              }}
              type="button"
            >
              Confirmar importación
            </Button>
          </div>
          {csvPreview ? (
            <output className="text-sm">
              {csvPreview.rows.length} filas válidas · {csvPreview.errors.length} errores
              {csvPreview.errors.length
                ? ` (${csvPreview.errors.map((item) => `fila ${item.row}: ${item.message}`).join('; ')})`
                : ''}
            </output>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Directorio</CardTitle>
          <CardDescription>Busca por nombre, teléfono o email.</CardDescription>
          <Button
            className="w-fit"
            disabled={exporting}
            onClick={() => void exportContacts()}
            type="button"
            variant="outline"
          >
            {exporting ? 'Preparando exportación…' : 'Exportar contactos CSV'}
          </Button>
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
          ) : error ? (
            <div className="grid gap-2" role="alert">
              <p className="text-destructive text-sm">{error}</p>
              <Button
                className="w-fit"
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  setReloadToken((value) => value + 1)
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Reintentar
              </Button>
            </div>
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
                      <span className="bg-primary/10 text-primary mr-2 rounded-full px-2 py-0.5 text-xs">
                        {classifyGuest({
                          visits: guest.visits,
                          spendCents: guest.spendCents,
                          daysSinceLastVisit: guest.history[0]
                            ? Math.floor(
                                (now - new Date(guest.history[0].createdAt).getTime()) / 86400000,
                              )
                            : 999,
                        })}
                      </span>
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
                              className={cn('rounded-full px-2 py-0.5 text-xs', {
                                'bg-muted text-muted-foreground': !active,
                                'bg-primary/10 text-primary': active,
                              })}
                              key={tag.id}
                              onClick={() =>
                                void toggleGuestTag({
                                  data: { tenantId, guestId: guest.id, tagId: tag.id },
                                }).then(
                                  () =>
                                    void searchGuests({
                                      data: { page: 1, pageSize: 25, query, tenantId, venueId },
                                    }).then((result) => setGuests(result.items)),
                                )
                              }
                              type="button"
                            >
                              {tag.label}
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            checked={guest.marketingConsent}
                            onChange={(event) =>
                              void (async () => {
                                try {
                                  await updateGuestMarketingConsent({
                                    data: {
                                      tenantId,
                                      guestId: guest.id,
                                      marketingConsent: event.target.checked,
                                    },
                                  })
                                  setGuests(
                                    (
                                      await searchGuests({
                                        data: { page: 1, pageSize: 25, query, tenantId, venueId },
                                      })
                                    ).items,
                                  )
                                } catch {
                                  setError('No se ha podido actualizar el consentimiento.')
                                }
                              })()
                            }
                            type="checkbox"
                          />
                          Acepta comunicaciones comerciales
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <label
                          className="text-muted-foreground text-xs"
                          htmlFor={`merge-${guest.id}`}
                        >
                          Fusionar este cliente en
                        </label>
                        <Select
                          id={`merge-${guest.id}`}
                          onSelectionChange={(key) =>
                            setMergeTarget(String(key) === 'empty' ? '' : String(key))
                          }
                          selectedKey={mergeTarget || 'empty'}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectList>
                              <SelectItem id="empty">Selecciona cliente destino</SelectItem>
                              {guests
                                .filter((candidate) => candidate.id !== guest.id)
                                .map((candidate) => (
                                  <SelectItem id={candidate.id} key={candidate.id}>
                                    {candidate.name}
                                  </SelectItem>
                                ))}
                            </SelectList>
                          </SelectContent>
                        </Select>
                        <Button
                          disabled={!mergeTarget || saving}
                          onClick={() =>
                            void (async () => {
                              if (
                                !window.confirm(
                                  '¿Fusionar este cliente? Esta acción no se puede deshacer.',
                                )
                              )
                                return
                              setSaving(true)
                              try {
                                await mergeGuests({
                                  data: {
                                    sourceGuestId: guest.id,
                                    targetGuestId: mergeTarget,
                                    tenantId,
                                  },
                                })
                                setSelected(null)
                                setMergeTarget('')
                                setGuests(
                                  (
                                    await searchGuests({
                                      data: { page: 1, pageSize: 25, query, tenantId, venueId },
                                    })
                                  ).items,
                                )
                                setError(null)
                              } catch {
                                setError('No se ha podido fusionar el cliente.')
                              } finally {
                                setSaving(false)
                              }
                            })()
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Fusionar
                        </Button>
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
                      <div className="grid gap-2 border-t pt-3 text-xs">
                        <p className="font-medium">Alergias y preferencias</p>
                        <div className="flex flex-wrap gap-1">
                          {guest.allergies.map((allergy) => (
                            <span
                              className="rounded-full bg-red-100 px-2 py-0.5 text-red-800"
                              key={allergy.allergen}
                            >
                              {allergy.allergen} · {allergy.severity}
                            </span>
                          ))}
                          {guest.preferences.map((preference) => (
                            <span
                              className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800"
                              key={preference.preference}
                            >
                              {preference.preference}
                            </span>
                          ))}
                          {!guest.allergies.length && !guest.preferences.length ? (
                            <span className="text-muted-foreground">
                              Sin atributos registrados.
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            aria-label={`Nuevo atributo para ${guest.name}`}
                            onChange={(event) => setAttribute(event.target.value)}
                            placeholder="Alergia o preferencia…"
                            value={attribute}
                          />
                          <Button
                            disabled={!attribute.trim() || saving}
                            onClick={() =>
                              void (async () => {
                                setSaving(true)
                                try {
                                  await addGuestPreference({
                                    data: { guestId: guest.id, tenantId, value: attribute },
                                  })
                                  setAttribute('')
                                  setGuests(
                                    (
                                      await searchGuests({
                                        data: { page: 1, pageSize: 25, query, tenantId, venueId },
                                      })
                                    ).items,
                                  )
                                } catch {
                                  setError('No se ha podido guardar la preferencia.')
                                } finally {
                                  setSaving(false)
                                }
                              })()
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Preferencia
                          </Button>
                          <Button
                            disabled={!attribute.trim() || saving}
                            onClick={() =>
                              void (async () => {
                                setSaving(true)
                                try {
                                  await addGuestAllergy({
                                    data: { guestId: guest.id, tenantId, value: attribute },
                                  })
                                  setAttribute('')
                                  setGuests(
                                    (
                                      await searchGuests({
                                        data: { page: 1, pageSize: 25, query, tenantId, venueId },
                                      })
                                    ).items,
                                  )
                                } catch {
                                  setError('No se ha podido guardar la alergia.')
                                } finally {
                                  setSaving(false)
                                }
                              })()
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Alergia
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          aria-label={`Nueva nota para ${guest.name}`}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Añadir nota interna…"
                          value={note}
                        />
                        <Select
                          aria-label="Categoría de la nota"
                          onSelectionChange={(key) =>
                            setNoteCategory(String(key) as typeof noteCategory)
                          }
                          selectedKey={noteCategory}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectList>
                              <SelectItem id="general">General</SelectItem>
                              <SelectItem id="preference">Preferencia</SelectItem>
                              <SelectItem id="allergy">Alergia</SelectItem>
                              <SelectItem id="incident">Incidencia</SelectItem>
                            </SelectList>
                          </SelectContent>
                        </Select>
                        <Button
                          disabled={!note.trim() || saving}
                          onClick={() =>
                            void (async () => {
                              setSaving(true)
                              try {
                                await addGuestNote({
                                  data: {
                                    body: note,
                                    category: noteCategory,
                                    guestId: guest.id,
                                    tenantId,
                                  },
                                })
                                setNote('')
                                setError(null)
                                const refreshed = await searchGuests({
                                  data: { tenantId, venueId, query, page: 1, pageSize: 25 },
                                })
                                setGuests(refreshed.items)
                              } catch {
                                setError('No se ha podido guardar la nota.')
                              } finally {
                                setSaving(false)
                              }
                            })()
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
