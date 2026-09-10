import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  useFormFeedback,
} from '@doscientos/ui'
import { useState } from 'react'

import { setMenuChannelPrice } from '@/features/menu'

export function ChannelPriceCard({
  menuItems,
  venueId,
  tenantId,
  onDone,
}: {
  menuItems: { id: string; name: string }[]
  tenantId: string
  venueId: string
  onDone: () => void
}) {
  const feedback = useFormFeedback()
  const [itemId, setItemId] = useState('')
  const [channel, setChannel] = useState<'room' | 'web' | 'delivery' | 'takeaway'>('web')
  const [price, setPrice] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Precios por canal</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (feedback.pending) return
            feedback.setPending()
            void setMenuChannelPrice({
              data: {
                tenantId,
                venueId,
                menuItemId: itemId,
                channel,
                isAvailable,
                priceCents: Math.round(Number(price) * 100),
              },
            })
              .then(() => {
                feedback.setSuccess('Precio guardado.')
                setPrice('')
                setIsAvailable(true)
                onDone()
              })
              .catch(() => feedback.setError('No se ha podido guardar el precio.'))
          }}
        >
          <Field>
            <FieldLabel htmlFor="channel-price-item">Producto</FieldLabel>
            <select
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              id="channel-price-item"
              onChange={(e) => setItemId(e.target.value)}
              required
              value={itemId}
            >
              <option value="">Seleccionar…</option>
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-price-channel">Canal</FieldLabel>
            <select
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              id="channel-price-channel"
              onChange={(e) => setChannel(e.target.value as typeof channel)}
              value={channel}
            >
              <option value="room">Sala</option>
              <option value="web">Web</option>
              <option value="delivery">Delivery</option>
              <option value="takeaway">Takeaway</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-price-value">Precio (€)</FieldLabel>
            <Input
              id="channel-price-value"
              min="0"
              onChange={(e) => setPrice(e.target.value)}
              required
              step="0.01"
              type="number"
              value={price}
            />
          </Field>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              checked={isAvailable}
              onChange={(event) => setIsAvailable(event.target.checked)}
              type="checkbox"
            />
            Disponible en este local
          </label>
          <Button type="submit">Guardar precio</Button>
        </form>
      </CardContent>
    </Card>
  )
}
