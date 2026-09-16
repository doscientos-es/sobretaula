import {
  AutocompleteCombobox,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@doscientos/ui'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import { listIngredients, listSuppliers } from '../application/product'
import {
  applyPurchaseDocumentReview,
  getPurchaseDocumentUrl,
  listPurchaseDocumentReviews,
  reviewPurchaseDocument,
} from '../application/purchase-document-reviews'
export function PurchaseDocumentReviewsPage({
  tenantId,
  venueId,
}: {
  tenantId: string
  venueId: string
}) {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof listPurchaseDocumentReviews>>['items']
  >([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [ingredients, setIngredients] = useState<
    Awaited<ReturnType<typeof listIngredients>>['items']
  >([])
  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<typeof listSuppliers>>['items']>([])
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().slice(0, 10))
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listPurchaseDocumentReviews({
        data: { tenantId, venueId, page, pageSize: 25 },
      })
      setRows(result.items)
      setHasMore(result.hasMore)
      setError(null)
    } catch {
      setError('No se han podido cargar las revisiones.')
    } finally {
      setLoading(false)
    }
  }, [page, tenantId, venueId])
  useAsyncEffect(load, [load])
  useEffect(() => {
    void Promise.all([
      listIngredients({
        data: { tenantId, venueId, page: 1, pageSize: 100, search: '' },
      }),
      listSuppliers({ data: { tenantId, venueId, page: 1, pageSize: 100, search: '' } }),
    ])
      .then(([ingredientResult, supplierResult]) => {
        setIngredients(ingredientResult.items)
        setSuppliers(supplierResult.items)
      })
      .catch(() => setError('No se han podido cargar proveedores e ingredientes.'))
  }, [tenantId, venueId])
  async function review(id: string, status: 'approved' | 'rejected') {
    if (pendingAction) return
    setPendingAction(`${id}:${status}`)
    try {
      await reviewPurchaseDocument({
        data: { tenantId, venueId, documentId: id, status },
      })
      await load()
    } catch {
      setError('No se ha podido guardar la revisión.')
    } finally {
      setPendingAction(null)
    }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      setError('Selecciona un documento PDF o imagen antes de subirlo.')
      return
    }
    setUploading(true)
    setError(null)
    form.set('venueId', venueId)
    try {
      const response = await fetch(`/api/t/${tenantId}/purchase-document`, {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error()
      event.currentTarget.reset()
      await load()
    } catch {
      setError('No se ha podido subir el documento.')
    } finally {
      setUploading(false)
    }
  }
  async function apply(row: (typeof rows)[number]) {
    if (!supplierId || !reference || !receivedOn) return
    if (pendingAction) return
    setPendingAction(`${row.id}:apply`)
    try {
      await applyPurchaseDocumentReview({
        data: {
          tenantId,
          venueId,
          documentId: row.id,
          supplierId,
          reference,
          receivedOn,
          mappings: row.extraction.lines.map((_, lineIndex) => ({
            lineIndex,
            ingredientId: mappings[`${row.id}:${lineIndex}`] ?? '',
          })),
        },
      })
      await load()
    } catch {
      setError('No se ha podido aplicar el documento. Revisa proveedor y mapeos.')
    } finally {
      setPendingAction(null)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisión de facturas y albaranes</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="mb-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => void upload(event)}
        >
          <label className="grid gap-1 text-sm" htmlFor="purchase-document-file">
            Documento PDF o imagen
            <Input
              accept="application/pdf,image/jpeg,image/png,image/webp"
              id="purchase-document-file"
              name="file"
              required
              type="file"
            />
          </label>
          <Button disabled={uploading} type="submit">
            {uploading ? 'Subiendo…' : 'Subir para revisar'}
          </Button>
        </form>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <output aria-busy="true" className="text-muted-foreground text-sm">
            Cargando revisiones…
          </output>
        ) : rows.length ? (
          <ul className="divide-border divide-y">
            {rows.map((row) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                key={row.id}
              >
                <span>
                  {row.objectPath ? (
                    <button
                      className="text-primary mr-2 underline underline-offset-2"
                      onClick={() =>
                        void (async () => {
                          try {
                            const result = await getPurchaseDocumentUrl({
                              data: { tenantId, venueId, documentId: row.id },
                            })
                            window.open(result.url, '_blank', 'noopener,noreferrer')
                          } catch {
                            setError('No se ha podido abrir el documento.')
                          }
                        })()
                      }
                      type="button"
                    >
                      {row.fileName}
                    </button>
                  ) : (
                    row.fileName
                  )}{' '}
                  · {row.extraction.lines.length} líneas · {row.status}
                </span>
                {row.status === 'approved' && row.extraction.lines.length ? (
                  <div className="grid w-full gap-2 rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <AutocompleteCombobox
                        aria-label="Proveedor"
                        className="w-56"
                        emptyState="No hay proveedores que coincidan."
                        getItemKey={(supplier) => supplier.id}
                        getItemLabel={(supplier) => supplier.name}
                        items={suppliers}
                        onSelectionChange={(key) => setSupplierId(key ? String(key) : '')}
                        placeholder="Buscar proveedor…"
                        selectedKey={supplierId || null}
                      />
                      <input
                        aria-label="Referencia"
                        className="rounded border px-2 py-1"
                        onChange={(event) => setReference(event.target.value)}
                        placeholder="Referencia"
                        value={reference}
                      />
                      <input
                        aria-label="Fecha de recepción"
                        className="rounded border px-2 py-1"
                        onChange={(event) => setReceivedOn(event.target.value)}
                        type="date"
                        value={receivedOn}
                      />
                    </div>
                    {row.extraction.lines.map((line, lineIndex) => (
                      <label
                        className="flex flex-wrap items-center gap-2"
                        key={`${row.id}:${lineIndex}`}
                      >
                        <span className="min-w-48">
                          {line.description} · {line.quantity} {line.unit}
                        </span>
                        <AutocompleteCombobox
                          aria-label={`Ingrediente para ${line.description}`}
                          className="w-56"
                          emptyState="No hay ingredientes que coincidan."
                          getItemKey={(ingredient) => ingredient.id}
                          getItemLabel={(ingredient) => ingredient.name}
                          items={ingredients}
                          onSelectionChange={(key) =>
                            setMappings((current) => ({
                              ...current,
                              [`${row.id}:${lineIndex}`]: key ? String(key) : '',
                            }))
                          }
                          placeholder="Buscar ingrediente…"
                          selectedKey={mappings[`${row.id}:${lineIndex}`] || null}
                        />
                      </label>
                    ))}
                    <Button
                      disabled={pendingAction !== null}
                      onClick={() => void apply(row)}
                      size="sm"
                      type="button"
                    >
                      {pendingAction === `${row.id}:apply`
                        ? 'Aplicando…'
                        : 'Crear albarán y aplicar'}
                    </Button>
                  </div>
                ) : null}
                {row.status === 'needs_review' ? (
                  <span className="flex gap-2">
                    <Button
                      disabled={pendingAction !== null}
                      onClick={() => void review(row.id, 'approved')}
                      size="sm"
                      type="button"
                    >
                      {pendingAction === `${row.id}:approved` ? 'Aprobando…' : 'Aprobar extracción'}
                    </Button>
                    <Button
                      disabled={pendingAction !== null}
                      onClick={() => void review(row.id, 'rejected')}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {pendingAction === `${row.id}:rejected` ? 'Rechazando…' : 'Rechazar'}
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No hay documentos pendientes.</p>
        )}
        {!error ? (
          <div className="mt-4 flex items-center justify-between">
            <Button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              type="button"
              variant="outline"
            >
              Anterior
            </Button>
            <span className="text-muted-foreground text-sm">Página {page}</span>
            <Button
              disabled={!hasMore}
              onClick={() => setPage((current) => current + 1)}
              type="button"
              variant="outline"
            >
              Siguiente
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
