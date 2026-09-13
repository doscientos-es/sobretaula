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

import {
  addInventoryMovement,
  createDeliveryNote,
  createIngredient,
  createSupplier,
  listIngredients,
  receiveDeliveryNote,
  replaceRecipe,
  type getInventory,
  type listSuppliers,
} from '../application/product'
import { ALLERGENS, calculateRecipeCost } from '../domain/product-costing'

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
}: {
  ingredients: Awaited<ReturnType<typeof listIngredients>>
  stock: Awaited<ReturnType<typeof getInventory>>
  menuItems: { id: string; name: string }[]
  tenantId: string
  venueId: string
  onDone: () => void
  suppliers: Awaited<ReturnType<typeof listSuppliers>>
}) {
  const feedback = useFormFeedback()
  const [ingredientList, setIngredientList] = useState(ingredients)
  const [ingredientSearchInput, setIngredientSearchInput] = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientPage, setIngredientPage] = useState(ingredients.page)
  const ingredientItems = ingredientList.items
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [deliveryReference, setDeliveryReference] = useState('')
  const [deliveryQuantity, setDeliveryQuantity] = useState('')
  const [deliveryCost, setDeliveryCost] = useState('')
  const [deliveryIngredientId, setDeliveryIngredientId] = useState('')
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
  useEffect(() => {
    let cancelled = false
    void listIngredients({
      data: {
        page: ingredientPage,
        pageSize: ingredients.pageSize,
        search: ingredientSearch,
        tenantId,
      },
    }).then((result) => {
      if (!cancelled) setIngredientList(result)
    })
    return () => {
      cancelled = true
    }
  }, [ingredientPage, ingredientSearch, ingredients.pageSize, tenantId])
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [cost, setCost] = useState('')
  const [minimum, setMinimum] = useState('')
  const [ingredientAllergens, setIngredientAllergens] = useState<(typeof ALLERGENS)[number][]>([])
  const [ingredientIsVegan, setIngredientIsVegan] = useState(false)
  const [ingredientId, setIngredientId] = useState('')
  const [movementQuantity, setMovementQuantity] = useState('')
  const [movementKind, setMovementKind] = useState<'purchase' | 'waste' | 'adjustment'>('purchase')
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
  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ingredientes e inventario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-5" onSubmit={(event) => void submit(event)}>
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
            <Button className="self-end" type="submit">
              Añadir
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
            disabled={!menuItemId || recipeLines.length === 0}
            onClick={() =>
              void replaceRecipe({ data: { tenantId, menuItemId, lines: recipeLines } }).then(
                () => {
                  feedback.setSuccess('Receta guardada.')
                  setRecipeLines([])
                  onDone()
                },
              )
            }
            type="button"
          >
            Guardar receta
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Registrar movimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <form
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
            <Button className="md:col-span-4 md:justify-self-end" type="submit">
              Registrar movimiento
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
                    {suppliers.map((supplier) => (
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
            <Button className="md:col-span-5 md:justify-self-end" type="submit">
              Recibir albarán
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Stock actual</CardTitle>
        </CardHeader>
        <CardContent>
          {stock.lowStockIngredientIds.length > 0 ? (
            <div className="bg-warning/15 text-warning-foreground mb-4 rounded-lg p-3 text-sm" role="alert">
              <strong>{stock.lowStockIngredientIds.length} ingredientes bajo mínimo.</strong>{' '}
              Revisa las compras antes del próximo servicio.
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
                {ingredientList.total === 0
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
        </CardContent>
      </Card>
    </section>
  )
}
