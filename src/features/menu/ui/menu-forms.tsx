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
import { useState, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { parsePriceToCents } from '@/shared/lib/money/money'

import { createMenuCategory, createMenuItem } from '../application/menu'
import {
  formatVatRate,
  localizedText,
  type KitchenStation,
  type MenuCategory,
} from '../domain/menu'

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
