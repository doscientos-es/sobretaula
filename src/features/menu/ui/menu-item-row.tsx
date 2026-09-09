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
import { formatVatRate, localizedText, type MenuItem } from '../domain/menu'

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
  const name = localizedText(item.nameI18n, locale)
  const priceChanged = parsePriceToCents(priceDraft) !== item.priceCents

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
    void run(
      () => updateMenuItem({ data: { itemId: item.id, priceCents, tenantId } }),
      'No se ha podido guardar el precio.',
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
          {priceChanged && (
            <Button disabled={feedback.pending} onClick={savePrice} size="sm" type="button">
              Guardar
            </Button>
          )}
        </span>
      </TableCell>
      <TableCell>{formatVatRate(item.vatRateBps, locale)}</TableCell>
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
