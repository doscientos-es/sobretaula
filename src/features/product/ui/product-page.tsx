import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormFeedback,
} from '@doscientos/ui'
import { useEffect, useMemo, useState } from 'react'

import type { DemandForecast } from '@/features/forecasting'
import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import {
  addInventoryMovement,
  createDeliveryNote,
  createIngredient,
  createPurchaseOrder,
  createSupplier,
  listIngredients,
  receiveDeliveryNote,
  replaceRecipe,
  type getInventory,
  type listPurchaseOrders,
  type listSuppliers,
} from '../application/product'
import { ALLERGENS, calculateRecipeCost } from '../domain/product-costing'
import { buildPurchaseRecommendation } from '../domain/purchase-recommendation'

const ALLERGEN_LABELS: Record<(typeof ALLERGENS)[number], string> = {
  gluten: 'Gluten',
  crustaceans: 'Crustáceos',
  eggs: 'Huevos',
  fish: 'Pescado',
  peanuts: 'Cacahuetes',
  soy: 'Soja',
  milk: 'Leche',
  nuts: 'Frutos de cáscara',
  celery: 'Apio',
  mustard: 'Mostaza',
  sesame: 'Sésamo',
  sulphites: 'Sulfitos',
  lupin: 'Altramuces',
  molluscs: 'Moluscos',
}

export function ProductPage({
  ingredients,
  stock,
  menuItems,
  tenantId,
  venueId,
  onDone,
  suppliers,
  forecast,
  purchaseOrders,
}: {
  ingredients: Awaited<ReturnType<typeof listIngredients>>
  stock: Awaited<ReturnType<typeof getInventory>>
  menuItems: { id: string; name: string }[]
  tenantId: string
  venueId: string
  onDone: () => void
  suppliers: Awaited<ReturnType<typeof listSuppliers>>
  forecast: DemandForecast
  purchaseOrders: Awaited<ReturnType<typeof listPurchaseOrders>>
}) {
  const feedback = useFormFeedback()
  const [ingredientList, setIngredientList] = useState(ingredients)
  const [ingredientSearchInput, setIngredientSearchInput] = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientPage, setIngredientPage] = useState(ingredients.page)
  const [ingredientLoading, setIngredientLoading] = useState(false)
  const [ingredientLoadError, setIngredientLoadError] = useState(false)
  const [ingredientRefresh, setIngredientRefresh] = useState(0)
  const ingredientItems = ingredientList.items
  const purchaseRecommendations = useMemo(
    () =>
      ingredientItems
        .map((ingredient) =>
          buildPurchaseRecommendation({
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            stock: stock.stock[ingredient.id] ?? 0,
            minimumStock: ingredient.minimumStock,
            forecastDemand: forecast.ingredientDemand[ingredient.id] ?? 0,
            unitCostCents: ingredient.costCentsPerUnit,
          }),
        )
        .filter((recommendation) => recommendation.quantity > 0),
    [forecast.ingredientDemand, ingredientItems, stock.stock],
  )
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [deliveryReference, setDeliveryReference] = useState('')
  const [deliveryQuantity, setDeliveryQuantity] = useState('')
  const [deliveryCost, setDeliveryCost] = useState('')
  const [deliveryIngredientId, setDeliveryIngredientId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  async function createRecommendedPurchase(
    recommendation: (typeof purchaseRecommendations)[number],
  ) {
    if (feedback.pending) return
    const selectedSupplierId = supplierId || suppliers.items[0]?.id
    if (!selectedSupplierId) {
      feedback.setError('Crea o selecciona un proveedor antes de generar el pedido.')
      return
    }
    feedback.setPending()
    try {
      await createPurchaseOrder({
        data: {
          tenantId,
          venueId,
          supplierId: selectedSupplierId,
          notes: `Generado desde previsión: ${recommendation.reason}`,
          lines: [
            {
              ingredientId: recommendation.ingredientId,
              quantity: recommendation.quantity,
              unitCostCents: recommendation.unitCostCents,
            },
          ],
        },
      })
      feedback.setSuccess(`Pedido creado para ${recommendation.ingredientName}.`)
      onDone()
    } catch {
      feedback.setError('No se ha podido crear el pedido recomendado.')
    }
  }
  async function receiveDelivery(event: React.FormEvent) {
    event.preventDefault()
    if (feedback.pending || !deliveryIngredientId) return
    feedback.setPending()
    try {
      let selectedSupplierId = supplierId
      if (!selectedSupplierId) {
        const created = await createSupplier({ data: { tenantId, name: supplierName } })
        selectedSupplierId = created.supplierId
      }
      const created = await createDeliveryNote({
        data: {
          tenantId,
          venueId,
          supplierId: selectedSupplierId,
          purchaseOrderId: purchaseOrderId || undefined,
          reference: deliveryReference,
          receivedOn: new Date().toISOString().slice(0, 10),
          lines: [
            {
              ingredientId: deliveryIngredientId,
              quantity: Number(deliveryQuantity),
              unitCostCents: Number(deliveryCost),
            },
          ],
        },
      })
      await receiveDeliveryNote({ data: { tenantId, deliveryNoteId: created.deliveryNoteId } })
      setDeliveryReference('')
      setDeliveryQuantity('')
      setDeliveryCost('')
      feedback.setSuccess('Albarán recibido y stock actualizado.')
      onDone()
    } catch {
      feedback.setError('No se ha podido recibir el albarán.')
    }
  }
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIngredientPage(1)
      setIngredientSearch(ingredientSearchInput)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [ingredientSearchInput])
  useAsyncEffect(() => {
    let cancelled = false
    setIngredientLoading(true)
    setIngredientLoadError(false)
    void listIngredients({
      data: {
        page: ingredientPage,
        pageSize: ingredients.pageSize,
        search: ingredientSearch,
        tenantId,
        venueId,
      },
    })
      .then((result) => {
        if (!cancelled) setIngredientList(result)
      })
      .catch(() => {
        if (!cancelled) setIngredientLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setIngredientLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ingredientPage, ingredientRefresh, ingredientSearch, ingredients.pageSize, tenantId, venueId])
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [cost, setCost] = useState('')
  const [minimum, setMinimum] = useState('')
  const [ingredientAllergens, setIngredientAllergens] = useState<(typeof ALLERGENS)[number][]>([])
  const [ingredientIsVegan, setIngredientIsVegan] = useState(false)
  const [ingredientId, setIngredientId] = useState('')
  const [movementQuantity, setMovementQuantity] = useState('')
  const [movementKind, setMovementKind] = useState<'purchase' | 'waste' | 'adjustment'>('purchase')
  const [wasteReason, setWasteReason] = useState<
    'expiry' | 'breakage' | 'overproduction' | 'return' | 'internal_consumption' | 'other'
  >('other')
  const [reason, setReason] = useState('')
  const [menuItemId, setMenuItemId] = useState('')
  const [recipeIngredientId, setRecipeIngredientId] = useState('')
  const [recipeQuantity, setRecipeQuantity] = useState('')
  const [recipeLines, setRecipeLines] = useState<
    { ingredientId: string; quantity: number; wastePercent: number }[]
  >([])
  const recipePreview = useMemo(
    () =>
      calculateRecipeCost(
        recipeLines.map((line) => {
          const ingredient = ingredientItems.find((item) => item.id === line.ingredientId)
          return {
            name: ingredient?.name ?? 'Ingrediente',
            quantity: line.quantity,
            costCentsPerUnit: ingredient?.costCentsPerUnit ?? 0,
            wastePercent: line.wastePercent,
            allergens: ingredient?.allergens ?? [],
            isVegan: ingredient?.isVegan ?? false,
          }
        }),
      ),
    [ingredientItems, recipeLines],
  )
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (feedback.pending) return
    feedback.setPending()
    try {
      await createIngredient({
        data: {
          tenantId,
          name,
          unit: unit as 'g' | 'kg' | 'ml' | 'l' | 'unit',
          costCentsPerUnit: Number(cost),
          minimumStock: Number(minimum),
          allergens: ingredientAllergens,
          isVegan: ingredientIsVegan,
        },
      })
      setName('')
      setCost('')
      setMinimum('')
      setIngredientAllergens([])
      setIngredientIsVegan(false)
      feedback.setSuccess('Ingrediente creado.')
      onDone()
    } catch {
      feedback.setError('No se ha podido crear el ingrediente.')
    }
  }
  async function saveRecipe() {
    if (feedback.pending || !menuItemId || recipeLines.length === 0) return
    feedback.setPending()
    try {
      await replaceRecipe({ data: { tenantId, menuItemId, lines: recipeLines } })
      feedback.setSuccess('Receta guardada.')
      setRecipeLines([])
      onDone()
    } catch {
      feedback.setError('No se ha podido guardar la receta.')
    }
  }
  return (
    <section className="space-y-6">
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader>
          <CardTitle>Compras recomendadas</CardTitle>
          <p className="text-muted-foreground text-sm">
            Productos por debajo del stock mínimo configurado.
          </p>
        </CardHeader>
        <CardContent>
          {purchaseRecommendations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay compras urgentes.</p>
          ) : (
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {purchaseRecommendations.map((recommendation) => (
                <li
                  className="flex justify-between gap-3 rounded-md border p-2"
                  key={recommendation.ingredientId}
                >
                  <span>{recommendation.ingredientName}</span>
                  <div className="flex items-center gap-2">
                    <strong>{recommendation.quantity} unidades</strong>
                    <Button
                      disabled={feedback.pending}
                      onClick={() => void createRecommendedPurchase(recommendation)}
                      size="sm"
                      type="button"
                    >
                      Crear pedido
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Previsión de demanda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <span>
            <strong>{forecast.expectedCovers}</strong> cubiertos previstos
          </span>
          <span>
            <strong>{(forecast.expectedSalesCents / 100).toFixed(2)} €</strong> de ventas estimadas
          </span>
          <span className="text-muted-foreground">
            Confianza {forecast.confidence} ·{' '}
            {forecast.sources.join(' · ') || 'sin datos históricos'}
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ingredientes e inventario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            aria-busy={feedback.pending}
            className="grid gap-3 md:grid-cols-5"
            onSubmit={(event) => void submit(event)}
          >
            <Field>
              <FieldLabel htmlFor="ingredient-name">Nombre</FieldLabel>
              <Input
                id="ingredient-name"
                onChange={(e) => setName(e.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ingredient-unit">Unidad</FieldLabel>
              <Select
                id="ingredient-unit"
                className="w-full"
                onSelectionChange={(key) => setUnit(String(key))}
                selectedKey={unit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="kg">kg</SelectItem>
                    <SelectItem id="g">g</SelectItem>
                    <SelectItem id="l">l</SelectItem>
                    <SelectItem id="ml">ml</SelectItem>
                    <SelectItem id="unit">unit</SelectItem>
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ingredient-cost">Coste céntimos/unidad</FieldLabel>
              <Input
                id="ingredient-cost"
                min="0"
                onChange={(e) => setCost(e.target.value)}
                required
                type="number"
                value={cost}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ingredient-minimum">Mínimo</FieldLabel>
              <Input
                id="ingredient-minimum"
                min="0"
                onChange={(e) => setMinimum(e.target.value)}
                required
                type="number"
                value={minimum}
              />
            </Field>
            <Button className="self-end" disabled={feedback.pending} type="submit">
              {feedback.pending ? 'Guardando…' : 'Añadir'}
            </Button>
          </form>
          <fieldset className="border-border rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Información alimentaria</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ALLERGENS.map((allergen) => (
                <Checkbox
                  isSelected={ingredientAllergens.includes(allergen)}
                  key={allergen}
                  onChange={(selected) =>
                    setIngredientAllergens((current) =>
                      selected
                        ? [...current, allergen]
                        : current.filter((value) => value !== allergen),
                    )
                  }
                >
                  {ALLERGEN_LABELS[allergen]}
                </Checkbox>
              ))}
              <Checkbox isSelected={ingredientIsVegan} onChange={setIngredientIsVegan}>
                Es vegano
              </Checkbox>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Las recetas heredarán automáticamente estos alérgenos y la etiqueta vegana en la
              carta.
            </p>
          </fieldset>
          <FormFeedback pendingLabel="Guardando…" state={feedback.state} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Receta y escandallo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="recipe-menu-item">Producto</FieldLabel>
            <Select
              id="recipe-menu-item"
              className="w-full"
              onSelectionChange={(key) => setMenuItemId(String(key) === 'empty' ? '' : String(key))}
              selectedKey={menuItemId || 'empty'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  <SelectItem id="empty">Seleccionar producto…</SelectItem>
                  {menuItems.map((item) => (
                    <SelectItem id={item.id} key={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          </Field>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!recipeIngredientId) return
              setRecipeLines([
                ...recipeLines,
                {
                  ingredientId: recipeIngredientId,
                  quantity: Number(recipeQuantity),
                  wastePercent: 0,
                },
              ])
              setRecipeIngredientId('')
              setRecipeQuantity('')
            }}
          >
            <Field>
              <FieldLabel htmlFor="delivery-purchase-order">Pedido relacionado</FieldLabel>
              <Select
                id="delivery-purchase-order"
                onSelectionChange={(key) => {
                  const id = String(key) === 'none' ? '' : String(key)
                  setPurchaseOrderId(id)
                  const order = purchaseOrders.items.find((candidate) => candidate.id === id)
                  if (!order) return
                  setSupplierId(order.supplierId)
                  const line = order.lines[0]
                  if (line) {
                    setDeliveryIngredientId(line.ingredientId)
                    setDeliveryQuantity(String(line.quantity))
                    setDeliveryCost(String(line.unitCostCents))
                  }
                }}
                selectedKey={purchaseOrderId || 'none'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="none">Sin pedido</SelectItem>
                    {purchaseOrders.items
                      .filter((order) => ['approved', 'sent'].includes(order.status))
                      .map((order) => (
                        <SelectItem id={order.id} key={order.id}>
                          Pedido {order.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="recipe-ingredient">Ingrediente</FieldLabel>
              <Select
                id="recipe-ingredient"
                className="w-full"
                onSelectionChange={(key) =>
                  setRecipeIngredientId(String(key) === 'empty' ? '' : String(key))
                }
                selectedKey={recipeIngredientId || 'empty'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="empty">Seleccionar…</SelectItem>
                    {ingredientItems.map((item) => (
                      <SelectItem id={item.id} key={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="recipe-quantity">Cantidad</FieldLabel>
              <Input
                id="recipe-quantity"
                min="0.0001"
                onChange={(e) => setRecipeQuantity(e.target.value)}
                required
                type="number"
                value={recipeQuantity}
              />
            </Field>
            <Button type="submit">Añadir a receta</Button>
          </form>
          <ul className="text-sm">
            {recipeLines.map((line, index) => (
              <li key={`${line.ingredientId}-${index}`}>
                {ingredientItems.find((item) => item.id === line.ingredientId)?.name}:{' '}
                {line.quantity}
              </li>
            ))}
          </ul>
          {recipeLines.length > 0 ? (
            <output className="bg-muted/40 block rounded-lg p-3 text-sm" aria-live="polite">
              <span className="font-medium">Vista previa de carta: </span>
              {recipePreview.isVegan ? 'Vegano' : 'No vegano'}
              {recipePreview.allergens.length > 0
                ? ` · Contiene ${recipePreview.allergens.map((item) => ALLERGEN_LABELS[item.name as (typeof ALLERGENS)[number]] ?? item.name).join(', ')}`
                : ' · Sin alérgenos declarados'}
            </output>
          ) : null}
          <Button
            disabled={feedback.pending || !menuItemId || recipeLines.length === 0}
            onClick={() => void saveRecipe()}
            type="button"
          >
            {feedback.pending ? 'Guardando…' : 'Guardar receta'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Registrar movimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            aria-busy={feedback.pending}
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                if (feedback.pending) return
                feedback.setPending()
                try {
                  await addInventoryMovement({
                    data: {
                      tenantId,
                      venueId,
                      ingredientId,
                      kind: movementKind,
                      ...(movementKind === 'waste' ? { wasteReason } : {}),
                      quantity: Number(movementQuantity),
                      reason,
                    },
                  })
                  setMovementQuantity('')
                  setReason('')
                  feedback.setSuccess('Movimiento registrado.')
                  onDone()
                } catch {
                  feedback.setError('No se ha podido registrar el movimiento.')
                }
              })()
            }}
          >
            <Field>
              <FieldLabel htmlFor="movement-ingredient">Ingrediente</FieldLabel>
              <Select
                id="movement-ingredient"
                className="w-full"
                isRequired
                onSelectionChange={(key) =>
                  setIngredientId(String(key) === 'empty' ? '' : String(key))
                }
                selectedKey={ingredientId || 'empty'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="empty">Seleccionar…</SelectItem>
                    {ingredientItems.map((ingredient) => (
                      <SelectItem id={ingredient.id} key={ingredient.id}>
                        {ingredient.name}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            {movementKind === 'waste' ? (
              <Field>
                <FieldLabel htmlFor="movement-waste-reason">Motivo de merma</FieldLabel>
                <Select
                  id="movement-waste-reason"
                  className="w-full"
                  onSelectionChange={(key) => setWasteReason(String(key) as typeof wasteReason)}
                  selectedKey={wasteReason}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      <SelectItem id="expiry">Caducidad</SelectItem>
                      <SelectItem id="breakage">Rotura</SelectItem>
                      <SelectItem id="overproduction">Sobreproducción</SelectItem>
                      <SelectItem id="return">Devolución</SelectItem>
                      <SelectItem id="internal_consumption">Consumo interno</SelectItem>
                      <SelectItem id="other">Otro</SelectItem>
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="movement-kind">Tipo</FieldLabel>
              <Select
                id="movement-kind"
                className="w-full"
                onSelectionChange={(key) => setMovementKind(String(key) as typeof movementKind)}
                selectedKey={movementKind}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="purchase">Compra (+)</SelectItem>
                    <SelectItem id="waste">Merma (-)</SelectItem>
                    <SelectItem id="adjustment">Ajuste (+/-)</SelectItem>
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="movement-quantity">Cantidad (+/-)</FieldLabel>
              <Input
                id="movement-quantity"
                onChange={(e) => setMovementQuantity(e.target.value)}
                required
                type="number"
                value={movementQuantity}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="movement-reason">Motivo</FieldLabel>
              <Input
                id="movement-reason"
                onChange={(e) => setReason(e.target.value)}
                required
                value={reason}
              />
            </Field>
            <Button
              className="md:col-span-4 md:justify-self-end"
              disabled={feedback.pending}
              type="submit"
            >
              {feedback.pending ? 'Registrando…' : 'Registrar movimiento'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recepción de mercancía</CardTitle>
          <p className="text-muted-foreground text-sm">
            Registra un albarán y actualiza el stock con trazabilidad.
          </p>
        </CardHeader>
        <CardContent>
          <form
            aria-busy={feedback.pending}
            className="grid gap-3 md:grid-cols-5"
            onSubmit={(event) => void receiveDelivery(event)}
          >
            <Field>
              <FieldLabel htmlFor="delivery-supplier">Proveedor</FieldLabel>
              <Select
                id="delivery-supplier"
                onSelectionChange={(key) => setSupplierId(String(key) === 'new' ? '' : String(key))}
                selectedKey={supplierId || 'new'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="new">Nuevo proveedor…</SelectItem>
                    {suppliers.items.map((supplier) => (
                      <SelectItem id={supplier.id} key={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            {!supplierId ? (
              <Field>
                <FieldLabel htmlFor="delivery-supplier-name">Nombre proveedor</FieldLabel>
                <Input
                  id="delivery-supplier-name"
                  onChange={(event) => setSupplierName(event.target.value)}
                  required
                  value={supplierName}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="delivery-reference">Referencia albarán</FieldLabel>
              <Input
                id="delivery-reference"
                onChange={(event) => setDeliveryReference(event.target.value)}
                required
                value={deliveryReference}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delivery-ingredient">Ingrediente</FieldLabel>
              <Select
                id="delivery-ingredient"
                onSelectionChange={(key) =>
                  setDeliveryIngredientId(String(key) === 'empty' ? '' : String(key))
                }
                selectedKey={deliveryIngredientId || 'empty'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="empty">Seleccionar…</SelectItem>
                    {ingredientItems.map((ingredient) => (
                      <SelectItem id={ingredient.id} key={ingredient.id}>
                        {ingredient.name}
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="delivery-quantity">Cantidad</FieldLabel>
              <Input
                id="delivery-quantity"
                min="0.0001"
                onChange={(event) => setDeliveryQuantity(event.target.value)}
                required
                type="number"
                value={deliveryQuantity}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delivery-cost">Coste céntimos/unidad</FieldLabel>
              <Input
                id="delivery-cost"
                min="0"
                onChange={(event) => setDeliveryCost(event.target.value)}
                required
                type="number"
                value={deliveryCost}
              />
            </Field>
            <Button
              className="md:col-span-5 md:justify-self-end"
              disabled={feedback.pending}
              type="submit"
            >
              {feedback.pending ? 'Recibiendo…' : 'Recibir albarán'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card aria-busy={ingredientLoading}>
        <CardHeader>
          <CardTitle>Stock actual</CardTitle>
        </CardHeader>
        <CardContent>
          {stock.lowStockIngredientIds.length > 0 ? (
            <div
              className="bg-warning/15 text-warning-foreground mb-4 rounded-lg p-3 text-sm"
              role="alert"
            >
              <strong>{stock.lowStockIngredientIds.length} ingredientes bajo mínimo.</strong> Revisa
              las compras antes del próximo servicio.
            </div>
          ) : (
            <output className="text-success mb-4 block text-sm" aria-live="polite">
              Stock por encima de los mínimos configurados.
            </output>
          )}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <Field className="min-w-56">
              <FieldLabel htmlFor="ingredient-search">Buscar ingrediente</FieldLabel>
              <Input
                id="ingredient-search"
                onChange={(event) => setIngredientSearchInput(event.target.value)}
                placeholder="Ej. tomate"
                type="search"
                value={ingredientSearchInput}
              />
            </Field>
            <div className="flex items-center gap-2" aria-live="polite">
              <span className="text-muted-foreground text-sm">
                {ingredientLoading
                  ? 'Actualizando inventario…'
                  : ingredientList.total === 0
                    ? 'Sin resultados'
                    : `Página ${ingredientList.page} · ${ingredientList.total} ingredientes`}
              </span>
              <Button
                disabled={ingredientList.page <= 1}
                onClick={() => setIngredientPage((page) => Math.max(1, page - 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                Anterior
              </Button>
              <Button
                disabled={!ingredientList.hasMore}
                onClick={() => setIngredientPage((page) => page + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          </div>
          {ingredientLoadError ? (
            <div className="mb-4 flex flex-wrap items-center gap-3" role="alert">
              <p className="text-destructive text-sm">No se ha podido actualizar el inventario.</p>
              <Button
                onClick={() => setIngredientRefresh((current) => current + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Reintentar
              </Button>
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredientItems.map((ingredient) => {
                const current = stock.stock[ingredient.id] ?? 0
                const low = stock.lowStockIngredientIds.includes(ingredient.id)
                return (
                  <TableRow key={ingredient.id}>
                    <TableCell>{ingredient.name}</TableCell>
                    <TableCell>{ingredient.unit}</TableCell>
                    <TableCell>{current}</TableCell>
                    <TableCell>{ingredient.minimumStock}</TableCell>
                    <TableCell>
                      {low ? <span className="text-destructive">Bajo mínimo</span> : 'Correcto'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {Object.keys(stock.recipeAvailability).length > 0 ? (
            <div className="mt-5 border-t pt-4">
              <h3 className="font-medium">Capacidad de venta por receta</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {menuItems.map((item) => {
                  const availability = stock.recipeAvailability[item.id]
                  if (!availability) return null
                  return (
                    <li className="bg-muted/30 rounded-lg p-3 text-sm" key={item.id}>
                      <span className="font-medium">{item.name}</span> ·{' '}
                      {availability.maxPortions === null
                        ? 'sin receta configurada'
                        : `${availability.maxPortions} raciones disponibles`}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
