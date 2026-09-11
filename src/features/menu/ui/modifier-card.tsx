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

import { parsePriceToCents } from '@/shared/lib/money/money'

import { createModifierGroup, createModifierOption, type MenuCatalog } from '../application/menu'
import { localizedText } from '../domain/menu'

export function ModifierCard({
  menu,
  onDone,
  tenantId,
}: {
  menu: MenuCatalog
  onDone: () => void
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [menuItemId, setMenuItemId] = useState(menu.items[0]?.id ?? '')
  const [groupName, setGroupName] = useState('')
  const [optionName, setOptionName] = useState('')
  const [optionPrice, setOptionPrice] = useState('0,00')
  const [selectionMin, setSelectionMin] = useState(0)
  const [selectionMax, setSelectionMax] = useState(1)

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
            <FieldLabel htmlFor="modifier-item">Plato</FieldLabel>
            <Select
              id="modifier-item"
              className="w-full"
              isRequired
              onSelectionChange={(key) => setMenuItemId(String(key))}
              selectedKey={menuItemId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  {menu.items.map((item) => (
                    <SelectItem id={item.id} key={item.id}>
                      {localizedText(item.nameI18n, 'es')}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="modifier-group">Grupo</FieldLabel>
            <Input
              id="modifier-group"
              onChange={(event) => setGroupName(event.target.value)}
              required
              value={groupName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="modifier-option">Opción</FieldLabel>
            <Input
              id="modifier-option"
              onChange={(event) => setOptionName(event.target.value)}
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
              type="number"
              value={selectionMax}
            />
          </Field>
          <FormFeedback pendingLabel="Guardando modificador…" state={feedback.state} />
          <Button disabled={feedback.pending || !menuItemId} type="submit">
            Añadir modificador
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
