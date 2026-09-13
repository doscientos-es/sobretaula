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
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type DragEvent, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { parsePriceToCents } from '@/shared/lib/money/money'

import { createMenuCategory, createMenuItem, importMenuCsv } from '../application/menu'
import {
  formatVatRate,
  localizedText,
  type KitchenStation,
  type MenuCategory,
} from '../domain/menu'
import { previewMenuCsv, type MenuImportPreview } from '../domain/menu-import'

const VAT_RATE_OPTIONS = [1000, 2100, 400, 0] as const

/** Management forms of the carta: new category first, then dishes into it. */
export function MenuForms({
  categories,
  locale,
  onDone,
  tenantId,
}: {
  categories: readonly MenuCategory[]
  locale: Locale
  onDone: () => void
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [categoryName, setCategoryName] = useState('')
  const [categoryNameCa, setCategoryNameCa] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState(categories[0]?.id ?? '')
  const [itemName, setItemName] = useState('')
  const [itemNameCa, setItemNameCa] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemVatRate, setItemVatRate] = useState<number>(1000)
  const [itemPreparationMinutes, setItemPreparationMinutes] = useState(15)
  const [itemKitchenStation, setItemKitchenStation] = useState<KitchenStation>('general')
  const [itemSku, setItemSku] = useState('')
  const [csv, setCsv] = useState('')
  const [csvPreview, setCsvPreview] = useState<MenuImportPreview | null>(null)
  const [csvFileName, setCsvFileName] = useState('')
  const [isDraggingCsv, setIsDraggingCsv] = useState(false)

  async function run(action: () => Promise<unknown>, message: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      await action()
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
            ...(categoryNameCa ? { nameCa: categoryNameCa } : {}),
            nameEs: categoryName,
            position: categories.length,
            tenantId,
          },
        }),
      'No se ha podido crear la categoría.',
    )
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const priceCents = parsePriceToCents(itemPrice)
    if (!itemCategoryId) {
      feedback.setError('Crea primero una categoría.')
      return
    }
    if (priceCents === null) {
      feedback.setError('Precio no válido. Usa euros con dos decimales, por ejemplo 12,50.')
      return
    }
    void run(
      () =>
        createMenuItem({
          data: {
            categoryId: itemCategoryId,
            ...(itemNameCa ? { nameCa: itemNameCa } : {}),
            nameEs: itemName,
            priceCents,
            preparationMinutes: itemPreparationMinutes,
            kitchenStation: itemKitchenStation,
            ...(itemSku ? { sku: itemSku } : {}),
            tenantId,
            vatRateBps: itemVatRate,
          },
        }),
      'No se ha podido crear el plato. Revisa que el SKU no esté repetido.',
    )
  }

  function previewImport() {
    setCsvPreview(previewMenuCsv(csv))
  }

  async function loadCsvFile(file: File | undefined) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      feedback.setError('Selecciona un archivo CSV.')
      return
    }
    const contents = await file.text()
    setCsv(contents)
    setCsvFileName(file.name)
    setCsvPreview(previewMenuCsv(contents))
  }

  function dropCsv(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDraggingCsv(false)
    void loadCsvFile(event.dataTransfer.files[0])
  }

  function importCatalog() {
    if (!csvPreview || csvPreview.errors.length || !csvPreview.rows.length) return
    void run(
      () => importMenuCsv({ data: { csv, tenantId } }),
      'No se ha podido importar la carta. No se han aplicado las filas con errores.',
    )
  }

  return (
    <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
      <Card>
        <CardHeader>
          <CardTitle>Nueva categoría</CardTitle>
          <CardDescription>El nombre en castellano es obligatorio.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={addCategory}>
            <Field>
              <FieldLabel htmlFor="category-name-es">Nombre</FieldLabel>
              <Input
                id="category-name-es"
                onChange={(event) => setCategoryName(event.target.value)}
                required
                value={categoryName}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="category-name-ca">Nom (català, opcional)</FieldLabel>
              <Input
                id="category-name-ca"
                onChange={(event) => setCategoryNameCa(event.target.value)}
                value={categoryNameCa}
              />
            </Field>
            <Button disabled={feedback.pending} type="submit">
              Crear categoría
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Importar carta</CardTitle>
          <CardDescription>
            Suelta aquí un archivo CSV o selecciónalo. Verás los datos y los errores antes de
            confirmar la carga. Columnas: categoria, nombre, precio, iva y opcionalmente sku y
            descripcion.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label
            aria-label="Seleccionar archivo CSV de carta"
            className={`grid min-h-28 cursor-pointer place-items-center rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors ${
              isDraggingCsv
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40'
            }`}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDraggingCsv(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setIsDraggingCsv(false)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropCsv}
            htmlFor="menu-csv-file"
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
              aria-label="Archivo CSV de carta"
              className="sr-only"
              id="menu-csv-file"
              onChange={(event) => void loadCsvFile(event.target.files?.[0])}
              type="file"
            />
          </label>
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
      </Card>
      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo plato</CardTitle>
            <CardDescription>Precio con IVA incluido, como se muestra al cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={addItem}>
              <Field>
                <FieldLabel htmlFor="item-category">Categoría</FieldLabel>
                <Select
                  className="w-full"
                  id="item-category"
                  onSelectionChange={(key) => setItemCategoryId(String(key))}
                  selectedKey={itemCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {categories.map((category) => (
                        <SelectItem id={category.id} key={category.id}>
                          {localizedText(category.nameI18n, locale)}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="item-name-es">Nombre</FieldLabel>
                <Input
                  id="item-name-es"
                  onChange={(event) => setItemName(event.target.value)}
                  required
                  value={itemName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="item-name-ca">Nom (català, opcional)</FieldLabel>
                <Input
                  id="item-name-ca"
                  onChange={(event) => setItemNameCa(event.target.value)}
                  value={itemNameCa}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="item-price">Precio (euros)</FieldLabel>
                <Input
                  id="item-price"
                  inputMode="decimal"
                  onChange={(event) => setItemPrice(event.target.value)}
                  placeholder="12,50"
                  required
                  value={itemPrice}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="item-vat">Tipo de IVA</FieldLabel>
                <Select
                  className="w-full"
                  id="item-vat"
                  onSelectionChange={(key) => setItemVatRate(Number(key))}
                  selectedKey={String(itemVatRate)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {VAT_RATE_OPTIONS.map((bps) => (
                        <SelectItem id={String(bps)} key={bps}>
                          {formatVatRate(bps, locale)}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="item-preparation">Preparación (minutos)</FieldLabel>
                <Input
                  id="item-preparation"
                  max={240}
                  min={1}
                  onChange={(event) => setItemPreparationMinutes(Number(event.target.value))}
                  type="number"
                  value={itemPreparationMinutes}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="item-station">Estación</FieldLabel>
                <Select
                  className="w-full"
                  id="item-station"
                  onSelectionChange={(key) => setItemKitchenStation(String(key) as KitchenStation)}
                  selectedKey={itemKitchenStation}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      <SelectItem id="general">General</SelectItem>
                      <SelectItem id="hot">Caliente</SelectItem>
                      <SelectItem id="cold">Frío</SelectItem>
                      <SelectItem id="bar">Barra</SelectItem>
                      <SelectItem id="dessert">Postres</SelectItem>
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="item-sku">SKU (opcional)</FieldLabel>
                <Input
                  id="item-sku"
                  onChange={(event) => setItemSku(event.target.value)}
                  value={itemSku}
                />
              </Field>
              <Button disabled={feedback.pending} type="submit">
                Añadir plato
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <FormFeedback pendingLabel="Guardando carta…" state={feedback.state} />
    </div>
  )
}
