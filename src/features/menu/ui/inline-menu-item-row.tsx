import {
  Button,
  FormFeedback,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  TableCell,
  TableRow,
  useFormFeedback,
} from '@doscientos/ui'
import { useState } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { parsePriceToCents } from '@/shared/lib/money/money'

import { createMenuItem } from '../application/menu'
import { formatVatRate, type KitchenStation } from '../domain/menu'

const VAT_RATE_OPTIONS = [1000, 2100, 400, 0] as const

/** Empty, in-table draft for adding a dish to one specific category. */
export function InlineMenuItemRow({
  categoryId,
  locale,
  onDone,
  tenantId,
}: {
  categoryId: string
  locale: Locale
  onDone: () => void
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [vatRate, setVatRate] = useState<string | null>('1000')
  const [preparationMinutes, setPreparationMinutes] = useState('')
  const [kitchenStation, setKitchenStation] = useState<KitchenStation | null>('general')

  function resetDraft() {
    setName('')
    setPrice('')
    setVatRate('1000')
    setPreparationMinutes('')
    setKitchenStation('general')
    feedback.reset()
  }

  function cancel() {
    resetDraft()
    setEditing(false)
  }

  async function save() {
    if (feedback.pending) return
    const priceCents = parsePriceToCents(price)
    const preparation = Number(preparationMinutes)
    if (!name.trim()) {
      feedback.setError('Indica el nombre del plato.')
      return
    }
    if (priceCents === null) {
      feedback.setError('Indica un precio válido, por ejemplo 12,50.')
      return
    }
    if (!vatRate) {
      feedback.setError('Selecciona el IVA.')
      return
    }
    if (!Number.isInteger(preparation) || preparation < 1 || preparation > 240) {
      feedback.setError('La preparación debe estar entre 1 y 240 minutos.')
      return
    }
    if (!kitchenStation) {
      feedback.setError('Selecciona una estación.')
      return
    }

    feedback.setPending()
    try {
      await createMenuItem({
        data: {
          categoryId,
          kitchenStation,
          nameEs: name.trim(),
          preparationMinutes: preparation,
          priceCents,
          tenantId,
          vatRateBps: Number(vatRate),
        },
      })
      cancel()
      onDone()
    } catch {
      feedback.setError('No se ha podido guardar el plato.')
    }
  }

  if (!editing) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell colSpan={6}>
          <Button onClick={() => setEditing(true)} size="sm" type="button" variant="outline">
            Añadir plato
          </Button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-primary/5 align-top">
      <TableCell>
        <Input
          aria-label="Nombre del nuevo plato"
          className="h-8 min-w-40"
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre del plato"
          value={name}
        />
      </TableCell>
      <TableCell>
        <Input
          aria-label="Precio del nuevo plato"
          className="h-8 w-24"
          inputMode="decimal"
          onChange={(event) => setPrice(event.target.value)}
          placeholder="12,50"
          value={price}
        />
      </TableCell>
      <TableCell>
        <Select
          aria-label="IVA del nuevo plato"
          onSelectionChange={(key) => setVatRate(String(key))}
          placeholder="IVA"
          selectedKey={vatRate}
        >
          <SelectTrigger aria-label="IVA del nuevo plato" className="h-8 min-w-24">
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
      </TableCell>
      <TableCell>
        <Input
          aria-label="Preparación del nuevo plato"
          className="h-8 w-20"
          max={240}
          min={1}
          onChange={(event) => setPreparationMinutes(event.target.value)}
          placeholder="Min."
          type="number"
          value={preparationMinutes}
        />
      </TableCell>
      <TableCell>
        <Select
          aria-label="Estación del nuevo plato"
          onSelectionChange={(key) => setKitchenStation(String(key) as KitchenStation)}
          placeholder="Estación"
          selectedKey={kitchenStation}
        >
          <SelectTrigger aria-label="Estación del nuevo plato" className="h-8 min-w-28">
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
      </TableCell>
      <TableCell>
        <div className="flex min-w-48 flex-nowrap items-center justify-end gap-2">
          <FormFeedback pendingLabel="Guardando…" state={feedback.state} />
          <Button disabled={feedback.pending} onClick={() => void save()} size="sm" type="button">
            Guardar plato
          </Button>
          <Button
            disabled={feedback.pending}
            onClick={cancel}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancelar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
