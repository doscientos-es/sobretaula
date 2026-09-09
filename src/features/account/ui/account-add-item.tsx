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
  QuantityInput,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { buildMenuSections, type MenuCatalog } from '@/features/menu'
import type { Locale } from '@/shared/lib/i18n/locale'
import { localizedText } from '@/shared/lib/i18n/localized-text'
import { formatMoney } from '@/shared/lib/money/money'

import { addOrderItem } from '../application/account'

/** Fast path of the waiter: pick a dish, a quantity, maybe a note, and add it. */
export function AccountAddItem({
  locale,
  menu,
  onDone,
  sessionId,
  tenantId,
  venueId,
}: {
  locale: Locale
  menu: MenuCatalog
  onDone: () => void
  sessionId: string
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const sections = buildMenuSections({
    categories: menu.categories,
    items: menu.items.filter((item) => item.isActive),
    locale,
  })
  const [menuItemId, setMenuItemId] = useState(
    sections.flatMap((section) => section.items)[0]?.id ?? '',
  )
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!menuItemId) {
      feedback.setError('No hay platos activos en la carta.')
      return
    }
    if (feedback.pending) return
    feedback.setPending()
    void addOrderItem({
      data: {
        menuItemId,
        ...(notes ? { notes } : {}),
        quantity,
        sessionId,
        tenantId,
        venueId,
      },
    })
      .then(() => {
        setNotes('')
        setQuantity(1)
        onDone()
      })
      .catch(() => feedback.setError('No se ha podido apuntar el plato.'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Añadir a la cuenta</CardTitle>
        <CardDescription>Sólo aparecen los platos activos de la carta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={add}>
          <Field>
            <FieldLabel htmlFor="account-item">Plato</FieldLabel>
            <select
              id="account-item"
              onChange={(event) => setMenuItemId(event.target.value)}
              value={menuItemId}
            >
              {sections.map((section) => (
                <optgroup
                  key={section.category.id}
                  label={localizedText(section.category.nameI18n, locale)}
                >
                  {section.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {`${localizedText(item.nameI18n, locale)} · ${formatMoney(item.priceCents, locale)}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="account-quantity">Cantidad</FieldLabel>
            <QuantityInput
              aria-label="Cantidad"
              minValue={1}
              onChange={(value) => setQuantity(value)}
              value={quantity}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-notes">Nota para cocina (opcional)</FieldLabel>
            <Input
              id="account-notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Sin cebolla, punto fuerte…"
              value={notes}
            />
          </Field>
          <FormFeedback pendingLabel="Apuntando…" state={feedback.state} />
          <Button disabled={feedback.pending || !menuItemId} type="submit">
            Apuntar en la cuenta
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
