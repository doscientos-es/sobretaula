import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
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
            <Select
              className="w-full"
              id="channel-price-item"
              isRequired
              onSelectionChange={(key) => setItemId(String(key) === 'empty' ? '' : String(key))}
              selectedKey={itemId || 'empty'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  <SelectItem id="empty">Seleccionar…</SelectItem>
                  {menuItems.map((item) => (
                    <SelectItem id={item.id} key={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-price-channel">Canal</FieldLabel>
            <Select
              className="w-full"
              id="channel-price-channel"
              onSelectionChange={(key) => setChannel(String(key) as typeof channel)}
              selectedKey={channel}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  <SelectItem id="room">Sala</SelectItem>
                  <SelectItem id="web">Web</SelectItem>
                  <SelectItem id="delivery">Delivery</SelectItem>
                  <SelectItem id="takeaway">Takeaway</SelectItem>
                </SelectList>
              </SelectContent>
            </Select>
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
          <Checkbox isSelected={isAvailable} onChange={setIsAvailable}>
            Disponible en este local
          </Checkbox>
          <Button type="submit">Guardar precio</Button>
        </form>
      </CardContent>
    </Card>
  )
}
