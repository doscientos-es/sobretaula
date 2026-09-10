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
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { buildMenuSections, type MenuCatalog } from '@/features/menu'
import type { Locale } from '@/shared/lib/i18n/locale'
import { localizedText } from '@/shared/lib/i18n/localized-text'
import { formatMoney } from '@/shared/lib/money/money'

import { addOrderItem } from '../application/account'
import {
  createAccountOfflineStore,
  createAddOrderItemOperation,
  enqueueAccountOperation,
  flushAccountOperations,
} from '../application/account-offline-operations'

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
    items: menu.items.filter((item) => item.isActive && item.isAvailable !== false),
    locale,
  })
  const [menuItemId, setMenuItemId] = useState(
    sections.flatMap((section) => section.items)[0]?.id ?? '',
  )
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [modifierOptionIds, setModifierOptionIds] = useState<string[]>([])
  const [operationId, setOperationId] = useState(() => crypto.randomUUID())
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const offlineStore = useMemo(
    () => createAccountOfflineStore(tenantId, venueId),
    [tenantId, venueId],
  )
  const selectedItem = sections
    .flatMap((section) => section.items)
    .find((item) => item.id === menuItemId)

  useEffect(() => {
    const flush = () => {
      setIsOnline(true)
      void flushAccountOperations(offlineStore).then((result) => {
        if (result.completed > 0) onDone()
      })
    }
    const offline = () => setIsOnline(false)
    if (isOnline) flush()
    window.addEventListener('online', flush)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', flush)
      window.removeEventListener('offline', offline)
    }
  }, [isOnline, offlineStore, onDone])

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!menuItemId) {
      feedback.setError('No hay platos activos en la carta.')
      return
    }
    if (feedback.pending) return
    if (!isOnline) {
      enqueueAccountOperation(
        offlineStore,
        createAddOrderItemOperation({
          menuItemId,
          modifierOptionIds,
          ...(notes ? { notes } : {}),
          operationId,
          quantity,
          sessionId,
          tenantId,
          venueId,
        }),
      )
      setNotes('')
      setQuantity(1)
      setOperationId(crypto.randomUUID())
      feedback.setSuccess('Comanda guardada. Se enviará al recuperar la conexión.')
      return
    }
    feedback.setPending()
    void addOrderItem({
      data: {
        menuItemId,
        modifierOptionIds,
        ...(notes ? { notes } : {}),
        operationId,
        quantity,
        sessionId,
        tenantId,
        venueId,
      },
    })
      .then(() => {
        setNotes('')
        setQuantity(1)
        setOperationId(crypto.randomUUID())
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
              onChange={(event) => {
                setMenuItemId(event.target.value)
                setModifierOptionIds([])
              }}
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
          {selectedItem?.modifierGroups?.map((group) => (
            <fieldset className="grid gap-2" key={group.id}>
              <legend className="text-sm font-medium">
                {`${localizedText(group.nameI18n, locale)}${group.selectionMin > 0 ? ' (obligatorio)' : ''}`}
              </legend>
              {group.options.map((option) => {
                const checked = modifierOptionIds.includes(option.id)
                const disabled =
                  !checked &&
                  group.selectionMax === 1 &&
                  modifierOptionIds.some((id) => group.options.some((entry) => entry.id === id))
                return (
                  <label className="flex items-center gap-2 text-sm" key={option.id}>
                    <input
                      checked={checked}
                      disabled={disabled}
                      onChange={() =>
                        setModifierOptionIds((current) =>
                          checked
                            ? current.filter((id) => id !== option.id)
                            : [...current, option.id],
                        )
                      }
                      type="checkbox"
                    />
                    <span>{localizedText(option.nameI18n, locale)}</span>
                    {option.priceDeltaCents !== 0 && (
                      <span className="text-muted-foreground">
                        {option.priceDeltaCents > 0 ? '+' : ''}
                        {formatMoney(option.priceDeltaCents, locale)}
                      </span>
                    )}
                  </label>
                )
              })}
            </fieldset>
          ))}
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
