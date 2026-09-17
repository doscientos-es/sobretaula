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
  QuantityInput,
  useFormFeedback,
} from '@doscientos/ui'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

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
import { OPTIMISTIC_LINE_ID_PREFIX, type AccountLine } from '../domain/account'

function addItemErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('inventory_insufficient_stock'))
    return 'No hay stock suficiente para apuntar este plato.'
  if (message.includes('payment_session_not_open'))
    return 'La cuenta ya no está abierta. Actualiza la pantalla.'
  return 'No se ha podido apuntar el plato.'
}

/** Fast path of the waiter: pick a dish, a quantity, maybe a note, and add it. */
export function AccountAddItem({
  locale,
  menu,
  onDone,
  onOptimisticAdd,
  quickAdd = false,
  sessionId,
  tenantId,
  venueId,
}: {
  locale: Locale
  menu: MenuCatalog
  onDone: () => void
  onOptimisticAdd?: (line: AccountLine) => () => void
  quickAdd?: boolean
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
  const allItems = sections.flatMap((section) => section.items)
  const [selectedSectionId, setSelectedSectionId] = useState('all')
  const [menuItemId, setMenuItemId] = useState(allItems[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [modifierOptionIds, setModifierOptionIds] = useState<string[]>([])
  const operationIdRef = useRef(crypto.randomUUID())
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const offlineStore = useMemo(
    () => createAccountOfflineStore(tenantId, venueId),
    [tenantId, venueId],
  )
  const visibleItems =
    selectedSectionId === 'all'
      ? allItems
      : (sections.find((section) => section.category.id === selectedSectionId)?.items ?? [])
  const selectedItem = allItems.find((item) => item.id === menuItemId)
  const selectedItemRequiresModifiers =
    selectedItem?.modifierGroups?.some((group) => group.selectionMin > 0) ?? false
  const showCustomization = !quickAdd || selectedItemRequiresModifiers

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

  function addItem(
    itemId: string,
    itemQuantity: number,
    itemNotes: string,
    itemModifierOptionIds: string[],
  ) {
    if (!itemId) {
      feedback.setError('No hay platos activos en la carta.')
      return
    }
    if (feedback.pending && !quickAdd) return
    const currentOperationId = operationIdRef.current
    operationIdRef.current = crypto.randomUUID()
    const item = allItems.find((candidate) => candidate.id === itemId)
    if (!item) {
      feedback.setError('No hay platos activos en la carta.')
      return
    }
    const optimisticLine: AccountLine = {
      id: `${OPTIMISTIC_LINE_ID_PREFIX}${currentOperationId}`,
      kitchenStation: item.kitchenStation ?? 'general',
      modifiers: itemModifierOptionIds.flatMap(
        (optionId) =>
          item.modifierGroups?.flatMap((group) =>
            group.options
              .filter((option) => option.id === optionId)
              .map((option) => ({
                id: option.id,
                name: localizedText(option.nameI18n, locale),
                priceDeltaCents: option.priceDeltaCents,
              })),
          ) ?? [],
      ),
      name: localizedText(item.nameI18n, locale),
      notes: itemNotes || null,
      ...(item.preparationMinutes === undefined
        ? {}
        : { preparationMinutes: item.preparationMinutes }),
      quantity: itemQuantity,
      status: 'pending',
      unitPriceCents: item.priceCents,
      vatRateBps: item.vatRateBps,
    }
    const rollback = onOptimisticAdd?.(optimisticLine)
    if (rollback) feedback.setSuccess('Añadido')
    if (!isOnline) {
      enqueueAccountOperation(
        offlineStore,
        createAddOrderItemOperation({
          menuItemId: itemId,
          modifierOptionIds: itemModifierOptionIds,
          ...(itemNotes ? { notes: itemNotes } : {}),
          operationId: currentOperationId,
          quantity: itemQuantity,
          sessionId,
          tenantId,
          venueId,
        }),
      )
      setNotes('')
      setQuantity(1)
      feedback.setSuccess('Comanda guardada. Se enviará al recuperar la conexión.')
      return
    }
    if (!rollback) feedback.setPending()
    void addOrderItem({
      data: {
        menuItemId: itemId,
        modifierOptionIds: itemModifierOptionIds,
        ...(itemNotes ? { notes: itemNotes } : {}),
        operationId: currentOperationId,
        quantity: itemQuantity,
        sessionId,
        tenantId,
        venueId,
      },
    })
      .then(() => {
        setNotes('')
        setQuantity(1)
        if (!rollback) feedback.setSuccess('Plato apuntado.')
        onDone()
      })
      .catch((error: unknown) => {
        rollback?.()
        feedback.setError(addItemErrorMessage(error))
      })
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addItem(menuItemId, quantity, notes, modifierOptionIds)
  }

  function selectMenuItem(item: (typeof allItems)[number]) {
    setMenuItemId(item.id)
    setModifierOptionIds([])
    const requiresModifiers = item.modifierGroups?.some((group) => group.selectionMin > 0) ?? false
    if (quickAdd && !requiresModifiers) addItem(item.id, 1, '', [])
  }

  return (
    <Card className={quickAdd ? 'rounded-none border-0 bg-transparent shadow-none' : undefined}>
      <CardHeader className={quickAdd ? 'border-border/70 border-b px-0 py-0 pb-3' : undefined}>
        <CardTitle>Añadir a la cuenta</CardTitle>
        <CardDescription className={quickAdd ? 'hidden' : undefined}>
          {quickAdd
            ? 'Pulsa un plato para añadirlo directamente. Los que tengan opciones te pedirán configurarlas.'
            : 'Sólo aparecen los platos activos de la carta.'}
        </CardDescription>
      </CardHeader>
      <CardContent className={quickAdd ? 'px-0 pt-4' : undefined}>
        <form className="grid gap-4" onSubmit={add}>
          <div aria-label="Categorías de la carta" className="flex flex-wrap gap-2">
            <Button
              onClick={() => setSelectedSectionId('all')}
              size="sm"
              type="button"
              variant={selectedSectionId === 'all' ? 'default' : 'outline'}
            >
              Todo
            </Button>
            {sections.map((section) => (
              <Button
                key={section.category.id}
                onClick={() => {
                  setSelectedSectionId(section.category.id)
                  setMenuItemId(section.items[0]?.id ?? '')
                  setModifierOptionIds([])
                }}
                size="sm"
                type="button"
                variant={selectedSectionId === section.category.id ? 'default' : 'outline'}
              >
                {localizedText(section.category.nameI18n, locale)}
              </Button>
            ))}
          </div>
          {visibleItems.length > 0 && (
            <div aria-label="Productos de la categoría" className="grid grid-cols-2 gap-2">
              {visibleItems.map((item) => (
                <Button
                  className="h-auto min-h-16 justify-start text-left whitespace-normal"
                  key={item.id}
                  onClick={() => selectMenuItem(item)}
                  type="button"
                  variant={menuItemId === item.id ? 'secondary' : 'outline'}
                >
                  <span>
                    <span className="block font-medium">
                      {localizedText(item.nameI18n, locale)}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {formatMoney(item.priceCents, locale)}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          )}
          {showCustomization && (
            <>
              <Field>
                <AutocompleteCombobox
                  aria-label="Plato"
                  emptyState="No hay platos activos que coincidan."
                  getItemKey={(item) => item.id}
                  getItemLabel={(item) =>
                    `${localizedText(item.nameI18n, locale)} · ${formatMoney(item.priceCents, locale)}`
                  }
                  items={visibleItems}
                  label="Plato"
                  onSelectionChange={(key) => {
                    setMenuItemId(key ? String(key) : '')
                    setModifierOptionIds([])
                  }}
                  placeholder="Buscar plato…"
                  selectedKey={menuItemId || null}
                />
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
            </>
          )}
          <FormFeedback pendingLabel="Apuntando…" state={feedback.state} />
          {showCustomization && (
            <Button disabled={feedback.pending || !menuItemId} type="submit">
              Apuntar en la cuenta
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
