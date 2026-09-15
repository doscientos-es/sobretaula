import {
  AutocompleteCombobox,
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

import { parsePriceToCents } from '@/shared/lib/money/money'

import { createModifierGroup, createModifierOption, type MenuCatalog } from '../application/menu'
import { localizedText } from '../domain/menu'

type IngredientOption = { id: string; name: string }

export function ModifierCard({
  menu,
  onDone,
  tenantId,
  ingredients = [],
}: {
  menu: MenuCatalog
  onDone: () => void
  tenantId: string
  ingredients?: IngredientOption[]
}) {
  const feedback = useFormFeedback()
  const [menuItemId, setMenuItemId] = useState(menu.items[0]?.id ?? '')
  const [groupName, setGroupName] = useState('')
  const [optionName, setOptionName] = useState('')
  const [optionPrice, setOptionPrice] = useState('0,00')
  const [selectionMin, setSelectionMin] = useState(0)
  const [selectionMax, setSelectionMax] = useState(1)
  const [ingredientId, setIngredientId] = useState('')
  const [replacesIngredientId, setReplacesIngredientId] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending || !menuItemId) return
    const priceDeltaCents = parsePriceToCents(optionPrice)
    if (priceDeltaCents === null) {
      feedback.setError('El suplemento no tiene un importe válido.')
      return
    }
    if (selectionMin > selectionMax) {
      feedback.setError('El mínimo no puede superar el máximo.')
      return
    }
    feedback.setPending()
    try {
      const { groupId } = await createModifierGroup({
        data: {
          menuItemId,
          nameEs: groupName,
          selectionMax,
          selectionMin,
          tenantId,
        },
      })
      await createModifierOption({
        data: {
          groupId,
          nameEs: optionName,
          priceDeltaCents,
          ingredientId: ingredientId || undefined,
          replacesIngredientId: replacesIngredientId || undefined,
          tenantId,
        },
      })
      setGroupName('')
      setOptionName('')
      setOptionPrice('0,00')
      feedback.setSuccess('Modificador guardado.')
      onDone()
    } catch {
      feedback.setError('No se ha podido guardar el modificador.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modificadores</CardTitle>
        <CardDescription>Define un grupo y su primera opción para un plato.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <Field>
            <AutocompleteCombobox
              emptyState="No hay platos que coincidan."
              getItemKey={(item) => item.id}
              getItemLabel={(item) => localizedText(item.nameI18n, 'es')}
              isRequired
              items={menu.items}
              label="Plato"
              onSelectionChange={(key) => setMenuItemId(key ? String(key) : '')}
              placeholder="Buscar plato…"
              selectedKey={menuItemId || null}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="modifier-group">Grupo</FieldLabel>
            <Input
              id="modifier-group"
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Ej. Extras"
              required
              value={groupName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="modifier-option">Opción</FieldLabel>
            <Input
              id="modifier-option"
              onChange={(event) => setOptionName(event.target.value)}
              placeholder="Ej. Sin gluten"
              required
              value={optionName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="modifier-price">Suplemento (€)</FieldLabel>
            <Input
              id="modifier-price"
              inputMode="decimal"
              onChange={(event) => setOptionPrice(event.target.value)}
              placeholder="0,00"
              required
              value={optionPrice}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="modifier-min">Mínimo</FieldLabel>
            <Input
              id="modifier-min"
              min={0}
              onChange={(event) => setSelectionMin(Number(event.target.value))}
              placeholder="0"
              type="number"
              value={selectionMin}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="modifier-max">Máximo</FieldLabel>
            <Input
              id="modifier-max"
              min={1}
              onChange={(event) => setSelectionMax(Number(event.target.value))}
              placeholder="1"
              type="number"
              value={selectionMax}
            />
          </Field>
          {ingredients.length > 0 ? (
            <>
              <Field>
                <AutocompleteCombobox
                  description="Para que el stock se descuente bien, completa también el ingrediente que consume."
                  emptyState="No hay ingredientes que coincidan."
                  getItemKey={(ingredient) => ingredient.id}
                  getItemLabel={(ingredient) => ingredient.name}
                  items={ingredients}
                  label="Sustituye ingrediente (opcional)"
                  onSelectionChange={(key) => setReplacesIngredientId(key ? String(key) : '')}
                  placeholder="Buscar ingrediente…"
                  selectedKey={replacesIngredientId || null}
                />
              </Field>
              <Field>
                <AutocompleteCombobox
                  emptyState="No hay ingredientes que coincidan."
                  getItemKey={(ingredient) => ingredient.id}
                  getItemLabel={(ingredient) => ingredient.name}
                  items={ingredients}
                  label="Ingrediente que consume (opcional)"
                  onSelectionChange={(key) => setIngredientId(key ? String(key) : '')}
                  placeholder="Buscar ingrediente…"
                  selectedKey={ingredientId || null}
                />
              </Field>
            </>
          ) : null}
          <FormFeedback pendingLabel="Guardando modificador…" state={feedback.state} />
          {Boolean(replacesIngredientId) !== Boolean(ingredientId) ? (
            <p className="text-destructive text-xs">
              Selecciona ambos ingredientes o deja los dos sin configurar.
            </p>
          ) : null}
          <Button
            disabled={
              feedback.pending ||
              !menuItemId ||
              Boolean(replacesIngredientId) !== Boolean(ingredientId)
            }
            type="submit"
          >
            Añadir modificador
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
