import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DialogContent,
  DialogRoot,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  cn,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type DragEvent, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'

import { createMenuCategory, importMenuCsv } from '../application/menu'
import type { MenuCategory } from '../domain/menu'
import { previewMenuCsv, type MenuImportPreview } from '../domain/menu-import'

/** Global carta actions; dishes are created inline in their category. */
export function MenuForms({
  categories,
  onDone,
  tenantId,
  primaryLocale,
  categoryOpen,
  onCategoryOpenChange,
}: {
  categories: readonly MenuCategory[]
  onDone: () => void
  tenantId: string
  primaryLocale: Locale
  categoryOpen?: boolean
  onCategoryOpenChange?: (open: boolean) => void
}) {
  const feedback = useFormFeedback()
  const [categoryName, setCategoryName] = useState('')
  const [categoryNameCa, setCategoryNameCa] = useState('')
  const [categoryTranslationsOpen, setCategoryTranslationsOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [csvPreview, setCsvPreview] = useState<MenuImportPreview | null>(null)
  const [csvFileName, setCsvFileName] = useState('')
  const [isDraggingCsv, setIsDraggingCsv] = useState(false)
  const [localCategoryOpen, setLocalCategoryOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const isCategoryOpen = categoryOpen ?? localCategoryOpen
  const setCategoryOpen = onCategoryOpenChange ?? setLocalCategoryOpen

  async function run(action: () => Promise<unknown>, message: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      await action()
      setCategoryOpen(false)
      setImportOpen(false)
      onDone()
    } catch {
      feedback.setError(message)
    }
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(
      () =>
        createMenuCategory({
          data: {
            ...(primaryLocale === 'ca'
              ? { nameCa: categoryName, nameEs: categoryNameCa || categoryName }
              : { nameCa: categoryNameCa || undefined, nameEs: categoryName }),
            position: categories.length,
            tenantId,
          },
        }),
      'No se ha podido crear la categoría.',
    )
  }

  function previewImport() {
    setCsvPreview(previewMenuCsv(csv))
  }

  function downloadTemplate() {
    const template =
      '\uFEFFcategoria;nombre;precio;iva;sku;descripcion;grupo_modificador;modificador;suplemento\nEntrantes;Croquetas;8,50;10;ENT-001;Croquetas caseras;Punto;Poco hecho;0'
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }))
    link.download = 'plantilla-carta-sobretaula.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function loadCsvFile(file: File | undefined) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      feedback.setError('El archivo CSV no puede superar los 10 MB.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      feedback.setError('Selecciona un archivo CSV.')
      return
    }
    try {
      const contents = await file.text()
      setCsv(contents)
      setCsvFileName(file.name)
      setCsvPreview(previewMenuCsv(contents))
    } catch {
      feedback.setError('No se ha podido leer el archivo CSV.')
    }
  }

  function dropCsv(event: DragEvent<HTMLInputElement>) {
    event.preventDefault()
    setIsDraggingCsv(false)
    void loadCsvFile(event.dataTransfer.files[0])
  }

  function importCatalog() {
    if (!csvPreview || csvPreview.errors.length || !csvPreview.rows.length) return
    feedback.setPending()
    void importMenuCsv({ data: { csv, tenantId } })
      .then(() => {
        setCsv('')
        setCsvFileName('')
        setCsvPreview(null)
        feedback.setSuccess('Carta importada correctamente.')
        onDone()
      })
      .catch(() =>
        feedback.setError(
          'No se ha podido importar la carta. No se han aplicado las filas con errores.',
        ),
      )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <DialogRoot onOpenChange={setCategoryOpen} open={isCategoryOpen}>
        <Button onClick={() => setCategoryOpen(true)} type="button">
          Nueva categoría
        </Button>
        <DialogContent className="max-w-2xl">
          <CardHeader>
            <CardTitle>Nueva categoría</CardTitle>
          <CardDescription>
            Escribe el nombre principal que verá tu equipo y tus clientes.
          </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={addCategory}>
              <Field>
                <FieldLabel htmlFor="category-name-es">
                  Nombre principal ({primaryLocale === 'ca' ? 'catalán' : 'castellano'})
                </FieldLabel>
                <Input
                  id="category-name-es"
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Ej. Entrantes"
                  required
                  value={categoryName}
                />
              </Field>
              <details
                className="group rounded-lg border px-3 py-2"
                onToggle={(event) => setCategoryTranslationsOpen(event.currentTarget.open)}
                open={categoryTranslationsOpen}
              >
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    Añadir traducciones
                    <span aria-hidden="true" className="text-muted-foreground text-lg leading-none">
                      {categoryTranslationsOpen ? '−' : '+'}
                    </span>
                  </span>
                </summary>
                <div className="border-border/60 mt-3 grid gap-3 border-t pt-3">
                  <p className="text-muted-foreground text-xs">
                    Añade el nombre para los idiomas que tengas activos. El nombre principal se
                    mostrará si no hay traducción.
                  </p>
                  <Field>
                    <FieldLabel htmlFor="category-name-ca">
                      {primaryLocale === 'ca' ? 'Castellano' : 'Catalán'}
                    </FieldLabel>
                    <Input
                      id="category-name-ca"
                      onChange={(event) => setCategoryNameCa(event.target.value)}
                      placeholder={primaryLocale === 'ca' ? 'Ej. Entrantes' : 'Ej. Entrants'}
                      value={categoryNameCa}
                    />
                  </Field>
                </div>
              </details>
              <Button disabled={feedback.pending} type="submit">
                Crear categoría
              </Button>
            </form>
          </CardContent>
        </DialogContent>
      </DialogRoot>
      <DialogRoot onOpenChange={setImportOpen} open={importOpen}>
        <Button onClick={() => setImportOpen(true)} type="button" variant="outline">
          Importar carta
        </Button>
        <DialogContent className="max-w-3xl">
          <CardHeader>
            <CardTitle>Importar carta</CardTitle>
            <CardDescription>
              Suelta aquí un archivo CSV o selecciónalo. Verás los datos y los errores antes de
              confirmar la carga. Columnas: categoria, nombre, precio, iva y opcionalmente sku y
              descripcion. Opcionales: grupo_modificador, modificador y suplemento.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label
              aria-label="Seleccionar archivo CSV de carta"
              className={cn(
                'grid min-h-28 cursor-pointer place-items-center rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors',
                isDraggingCsv
                  ? 'border-primary bg-primary/10'
                  : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40',
              )}
              htmlFor="menu-csv-file"
            >
              <span>
                <strong>{csvFileName || 'Suelta el CSV aquí'}</strong>
                <br />
                <span className="text-muted-foreground">
                  {csvFileName
                    ? 'Archivo cargado · puedes reemplazarlo'
                    : 'o haz clic para buscarlo'}
                </span>
              </span>
              <input
                accept=".csv,text/csv"
                aria-label="Archivo CSV de carta"
                className="sr-only"
                id="menu-csv-file"
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
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={downloadTemplate} type="button" variant="ghost">
                Descargar plantilla CSV
              </Button>
              <span className="text-muted-foreground text-xs">
                Incluye una fila de ejemplo que puedes sustituir.
              </span>
            </div>
            <textarea
              aria-label="CSV de carta"
              className="min-h-32 w-full rounded-md border px-3 py-2 font-mono text-xs"
              onChange={(event) => {
                setCsv(event.target.value)
                setCsvFileName('')
                setCsvPreview(null)
              }}
              placeholder="categoria;nombre;precio;iva\nEntrantes;Croquetas;8,50;10"
              value={csv}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!csv.trim() || feedback.pending}
                onClick={previewImport}
                type="button"
                variant="outline"
              >
                Volver a validar
              </Button>
              <Button
                disabled={!csvPreview || csvPreview.errors.length > 0 || feedback.pending}
                onClick={importCatalog}
                type="button"
              >
                Confirmar importación
              </Button>
            </div>
            {csvPreview ? (
              <div className="grid gap-3">
                <output className="text-sm">
                  {csvPreview.rows.length} filas válidas · {csvPreview.errors.length} errores
                  {csvPreview.errors.length
                    ? ` (${csvPreview.errors.map((error) => `fila ${error.row}: ${error.message}`).join('; ')})`
                    : ''}
                </output>
                {csvPreview.rows.length ? (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[34rem] text-left text-xs">
                      <caption className="sr-only">Previsualización de la carta importada</caption>
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium" scope="col">
                            Categoría
                          </th>
                          <th className="px-3 py-2 font-medium" scope="col">
                            Plato
                          </th>
                          <th className="px-3 py-2 text-right font-medium" scope="col">
                            Precio
                          </th>
                          <th className="px-3 py-2 text-right font-medium" scope="col">
                            IVA
                          </th>
                          <th className="px-3 py-2 font-medium" scope="col">
                            Modificador
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.rows.slice(0, 10).map((row, index) => (
                          <tr className="border-t" key={`${row.nameEs}-${index}`}>
                            <td className="px-3 py-2">{row.category}</td>
                            <td className="px-3 py-2">{row.nameEs}</td>
                            <td className="px-3 py-2 text-right">
                              {(row.priceCents / 100).toFixed(2).replace('.', ',')} €
                            </td>
                            <td className="px-3 py-2 text-right">{row.vatRateBps / 100}%</td>
                            <td className="px-3 py-2">
                              {row.modifierName ? `${row.modifierGroup}: ${row.modifierName}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.rows.length > 10 ? (
                      <p className="text-muted-foreground border-t px-3 py-2 text-xs">
                        Mostrando 10 de {csvPreview.rows.length} filas válidas.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </DialogContent>
      </DialogRoot>
      <FormFeedback pendingLabel="Guardando carta…" state={feedback.state} />
    </div>
  )
}
