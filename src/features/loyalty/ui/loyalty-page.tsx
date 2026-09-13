import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@doscientos/ui'
import { useCallback, useEffect, useState } from 'react'

import {
  adjustLoyaltyPoints,
  listLoyaltyGuests,
  redeemLoyaltyPoints,
  type LoyaltyGuest,
} from '../application/loyalty'

export function LoyaltyPage({ tenantId }: { tenantId: string }) {
  const [guests, setGuests] = useState<LoyaltyGuest[]>([])
  const [selected, setSelected] = useState<LoyaltyGuest | null>(null)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setGuests(await listLoyaltyGuests({ data: { tenantId } }))
    } catch {
      setFeedback('No se ha podido cargar fidelización.')
    }
  }, [tenantId])
  useEffect(() => {
    void load()
  }, [load])
  async function save() {
    if (!selected || !reason.trim() || !Number.isInteger(Number(points))) return
    try {
      await adjustLoyaltyPoints({
        data: { tenantId, guestId: selected.id, points: Number(points), reason },
      })
      setFeedback('Saldo actualizado y auditado.')
      setPoints('')
      setReason('')
      setSelected(null)
      await load()
    } catch {
      setFeedback('No se ha podido actualizar el saldo.')
    }
  }
  async function redeem() {
    if (!selected || !reason.trim() || !Number.isInteger(Number(points)) || Number(points) <= 0)
      return
    try {
      await redeemLoyaltyPoints({
        data: { tenantId, guestId: selected.id, points: Number(points), reward: reason },
      })
      setFeedback('Recompensa canjeada y auditada.')
      setPoints('')
      setReason('')
      setSelected(null)
      await load()
    } catch {
      setFeedback('No hay puntos suficientes o no se ha podido canjear.')
    }
  }
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fidelización</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Convierte cada visita en recurrencia: 1 punto por euro y ajustes siempre auditados.
          </p>
          {feedback ? <output className="mt-2 block text-sm">{feedback}</output> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {guests.length ? (
            <ul className="divide-border divide-y">
              {guests.map((guest) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  key={guest.id}
                >
                  <div>
                    <p className="font-medium">{guest.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {guest.contact} · {guest.lifetimePoints} puntos acumulados
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong>{guest.points} puntos</strong>
                    <Button onClick={() => setSelected(guest)} size="sm" type="button">
                      Ajustar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Todavía no hay clientes con saldo.</p>
          )}
        </CardContent>
      </Card>
      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Ajustar saldo de {selected.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              aria-label="Puntos a añadir o quitar"
              onChange={(event) => setPoints(event.target.value)}
              placeholder="+100 o -50"
              type="number"
              value={points}
            />
            <Input
              aria-label="Motivo"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motivo obligatorio"
              value={reason}
            />
            <Button onClick={() => void save()} type="button">
              Guardar ajuste
            </Button>
            <Button onClick={() => void redeem()} type="button" variant="outline">
              Canjear recompensa
            </Button>
            <Button onClick={() => setSelected(null)} type="button" variant="outline">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
