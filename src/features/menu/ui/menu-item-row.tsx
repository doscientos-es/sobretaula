import {
  Badge,
  Button,
  FormFeedback,
  Input,
  TableCell,
  TableRow,
  useFormFeedback,
} from '@doscientos/ui'
import { useState } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { parsePriceToCents } from '@/shared/lib/money/money'

import { updateMenuItem } from '../application/menu'
import { formatVatRate, localizedText, type KitchenStation, type MenuItem } from '../domain/menu'

/** One dish of the carta: inline price edit plus the availability toggle. */
export function MenuItemRow({
  item,
  locale,
  onDone,
  tenantId,
}: {
  item: MenuItem
  locale: Locale
  onDone: () => void
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [priceDraft, setPriceDraft] = useState((item.priceCents / 100).toFixed(2))
  const [preparationDraft, setPreparationDraft] = useState(String(item.preparationMinutes ?? 15))
  const [stationDraft, setStationDraft] = useState<KitchenStation>(item.kitchenStation ?? 'general')
  const name = localizedText(item.nameI18n, locale)
  const priceChanged = parsePriceToCents(priceDraft) !== item.priceCents
  const preparationMinutes = Number(preparationDraft)
  const preparationChanged = preparationMinutes !== (item.preparationMinutes ?? 15)
  const stationChanged = stationDraft !== (item.kitchenStation ?? 'general')

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

  function savePrice() {
    const priceCents = parsePriceToCents(priceDraft)
    if (priceCents === null) {
      feedback.setError('Precio no válido. Usa euros con dos decimales, por ejemplo 12,50.')
      return
    }
    if (
      !Number.isInteger(preparationMinutes) ||
      preparationMinutes < 1 ||
      preparationMinutes > 240
    ) {
      feedback.setError('La preparación debe estar entre 1 y 240 minutos.')
      return
    }
    void run(
      () =>
        updateMenuItem({
          data: {
            itemId: item.id,
            kitchenStation: stationDraft,
            preparationMinutes,
            priceCents,
            tenantId,
          },
        }),
      'No se ha podido guardar la configuración del plato.',
    )
  }

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2">
          <span className="whitespace-normal">{name}</span>
          {!item.isActive && <Badge variant="neutral">Oculto</Badge>}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <Input
            aria-label={`Precio de ${name}`}
            className="h-8 w-24"
            inputMode="decimal"
            onChange={(event) => setPriceDraft(event.target.value)}
            value={priceDraft}
          />
          {(priceChanged || preparationChanged || stationChanged) && (
            <Button disabled={feedback.pending} onClick={savePrice} size="sm" type="button">
              Guardar
            </Button>
          )}
        </span>
      </TableCell>
      <TableCell>{formatVatRate(item.vatRateBps, locale)}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <Input
            aria-label={`Preparación de ${name}`}
            className="h-8 w-20"
            max={240}
            min={1}
            onChange={(event) => setPreparationDraft(event.target.value)}
            type="number"
            value={preparationDraft}
          />
          <span className="text-muted-foreground text-xs">min</span>
        </span>
      </TableCell>
      <TableCell>
        <select
          aria-label={`Estación de ${name}`}
          onChange={(event) => setStationDraft(event.target.value as KitchenStation)}
          value={stationDraft}
        >
          <option value="general">General</option>
          <option value="hot">Caliente</option>
          <option value="cold">Frío</option>
          <option value="bar">Barra</option>
          <option value="dessert">Postres</option>
        </select>
      </TableCell>
      <TableCell>
        <span className="flex items-center justify-end gap-3">
          <FormFeedback pendingLabel="Guardando…" state={feedback.state} />
          <Button
            disabled={feedback.pending}
            onClick={() =>
              void run(
                () =>
                  updateMenuItem({
                    data: { isActive: !item.isActive, itemId: item.id, tenantId },
                  }),
                'No se ha podido cambiar la disponibilidad.',
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {item.isActive ? 'Retirar' : 'Activar'}
          </Button>
        </span>
      </TableCell>
    </TableRow>
  )
}
