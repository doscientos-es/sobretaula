import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { useMemo, useState } from 'react'

import {
  calculateOnlineOrderTotal,
  createPublicOnlineOrder,
  type OnlineOrderLine,
} from '@/features/online-ordering'
import { ALLERGEN_LABELS, type Allergen } from '@/features/product/domain/product-costing'
import type { Locale } from '@/shared/lib/i18n/locale'

import type { MenuCatalog } from '../application/menu'
import { buildMenuSections, localizedText } from '../domain/menu'

export function PublicMenuPage({
  catalog,
  locale,
  tenantId,
  venueId,
}: {
  catalog: MenuCatalog
  locale: Locale
  tenantId?: string
  venueId?: string
}) {
  const [cart, setCart] = useState<OnlineOrderLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [channel, setChannel] = useState<'pickup' | 'delivery'>('pickup')
  const [message, setMessage] = useState<string | null>(null)
  const totalCents = useMemo(() => calculateOnlineOrderTotal(cart), [cart])
  const addToCart = (menuItemId: string, name: string, unitPriceCents: number) =>
    setCart((current) => {
      const existing = current.find((line) => line.menuItemId === menuItemId)
      if (existing)
        return current.map((line) =>
          line === existing ? { ...line, quantity: line.quantity + 1 } : line,
        )
      return [...current, { menuItemId, name, quantity: 1, unitPriceCents }]
    })
  const submitOrder = async () => {
    if (!tenantId || !venueId || !customerName.trim() || !cart.length) return
    setMessage('Enviando pedido…')
    try {
      const result = await createPublicOnlineOrder({
        data: {
          tenantId,
          venueId,
          customerName,
          customerPhone: customerPhone || undefined,
          channel,
          items: cart,
          idempotencyKey: crypto.randomUUID(),
        },
      })
      setCart([])
      setMessage(`Pedido recibido · total ${(result.totalCents / 100).toFixed(2)} €`)
    } catch {
      setMessage('No hemos podido enviar el pedido. Revisa los datos e inténtalo de nuevo.')
    }
  }
  const sections = buildMenuSections({
    categories: catalog.categories,
    items: catalog.items,
    locale,
  })
  return (
    <section className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader>
        <PageHeaderTitle>Carta</PageHeaderTitle>
        <PageHeaderDescription>
          Consulta nuestros platos, alérgenos e información alimentaria.
        </PageHeaderDescription>
      </PageHeader>
      {sections.map((section) => (
        <Card key={section.category.id}>
          <CardHeader>
            <CardTitle>{localizedText(section.category.nameI18n, locale)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {section.items.map((item) => (
              <article className="rounded-lg border p-4" key={item.id}>
                <div className="flex justify-between gap-3">
                  <h2 className="font-medium">{localizedText(item.nameI18n, locale)}</h2>
                  <span>{(item.priceCents / 100).toFixed(2)} €</span>
                </div>
                {localizedText(item.descriptionI18n, locale) && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {localizedText(item.descriptionI18n, locale)}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {item.isVegan && (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                      Vegano
                    </span>
                  )}
                  {item.allergens?.map((allergen) => (
                    <span
                      className="rounded-full bg-amber-100 px-2 py-1 text-amber-800"
                      key={allergen}
                    >
                      Contiene {ALLERGEN_LABELS[allergen as Allergen] ?? allergen}
                      {item.allergenReasons?.[allergen]?.length
                        ? ` · ${item.allergenReasons[allergen].join(', ')}`
                        : ''}
                    </span>
                  ))}
                </div>
                {item.modifierGroups?.length ? (
                  <div className="mt-3 border-t pt-3 text-sm">
                    <p className="font-medium">Opciones disponibles</p>
                    {item.modifierGroups.map((group) => (
                      <div className="mt-1" key={group.id}>
                        <span className="text-muted-foreground">
                          {localizedText(group.nameI18n, locale)}:{' '}
                        </span>
                        {group.options
                          .filter((option) => option.isActive)
                          .map((option, index) => (
                            <span key={option.id}>
                              {index > 0 ? ', ' : ''}
                              {localizedText(option.nameI18n, locale)}
                              {option.allergens?.length
                                ? ` (contiene ${option.allergens.map((allergen) => ALLERGEN_LABELS[allergen as Allergen] ?? allergen).join(', ')})`
                                : ''}
                            </span>
                          ))}
                      </div>
                    ))}
                  </div>
                ) : null}
                {tenantId && venueId && item.isAvailable !== false ? (
                  <button
                    className="bg-primary text-primary-foreground mt-4 rounded-md px-3 py-2 text-sm"
                    onClick={() =>
                      addToCart(item.id, localizedText(item.nameI18n, locale), item.priceCents)
                    }
                    type="button"
                  >
                    Añadir al pedido
                  </button>
                ) : null}
              </article>
            ))}
          </CardContent>
        </Card>
      ))}
      {tenantId && venueId ? (
        <Card className="sticky bottom-4 shadow-lg">
          <CardHeader>
            <CardTitle>Tu pedido · {(totalCents / 100).toFixed(2)} €</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length ? (
              cart.map((line) => (
                <div
                  className="flex justify-between text-sm"
                  key={`${line.name}-${line.unitPriceCents}`}
                >
                  <span>
                    {line.quantity} × {line.name}
                  </span>
                  <span>{((line.quantity * line.unitPriceCents) / 100).toFixed(2)} €</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">Añade platos para empezar.</p>
            )}
            <input
              className="border-input w-full rounded-md border px-3 py-2"
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Nombre"
              value={customerName}
            />
            <input
              className="border-input w-full rounded-md border px-3 py-2"
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="Teléfono (opcional)"
              value={customerPhone}
            />
            <select
              className="border-input w-full rounded-md border px-3 py-2"
              onChange={(event) => setChannel(event.target.value as 'pickup' | 'delivery')}
              value={channel}
            >
              <option value="pickup">Recoger en local</option>
              <option value="delivery">Entrega</option>
            </select>
            <button
              className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 disabled:opacity-50"
              disabled={!cart.length || !customerName.trim()}
              onClick={() => void submitOrder()}
              type="button"
            >
              Confirmar pedido
            </button>
            {message ? (
              <p aria-live="polite" className="text-sm">
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
