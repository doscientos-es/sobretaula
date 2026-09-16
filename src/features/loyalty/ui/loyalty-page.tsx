import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@doscientos/ui'
import { useCallback, useRef, useState } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const loadVersion = useRef(0)
  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listLoyaltyGuests({
        data: { tenantId, page, pageSize: 25 },
      })
      if (version !== loadVersion.current) return
      setGuests(result.items)
      setHasMore(result.hasMore)
      setLoadError(null)
    } catch {
      if (version === loadVersion.current)
        setLoadError('No se han podido cargar los puntos de clientes.')
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [page, tenantId])
  useAsyncEffect(load, [load])
  async function save() {
    if (pendingAction || !selected || !reason.trim() || !Number.isInteger(Number(points))) return
    setPendingAction(true)
    try {
      await adjustLoyaltyPoints({
        data: {
          tenantId,
          guestId: selected.id,
          points: Number(points),
          reason,
        },
      })
      setFeedback('Saldo actualizado y auditado.')
      setPoints('')
      setReason('')
      setSelected(null)
      await load()
    } catch {
      setFeedback('No se ha podido actualizar el saldo.')
    } finally {
      setPendingAction(false)
    }
  }
  async function redeem() {
    if (
      pendingAction ||
      !selected ||
      !reason.trim() ||
      !Number.isInteger(Number(points)) ||
      Number(points) <= 0
    )
      return
    setPendingAction(true)
    try {
      await redeemLoyaltyPoints({
        data: {
          tenantId,
          guestId: selected.id,
          points: Number(points),
          reward: reason,
        },
      })
      setFeedback('Recompensa canjeada y auditada.')
      setPoints('')
      setReason('')
      setSelected(null)
      await load()
    } catch {
      setFeedback('No hay puntos suficientes o no se ha podido canjear.')
    } finally {
      setPendingAction(false)
    }
  }
  const numericPoints = Number(points)
  const canSaveAdjustment =
    selected !== null &&
    reason.trim().length > 0 &&
    Number.isInteger(numericPoints) &&
    numericPoints !== 0
  const canRedeem =
    selected !== null &&
    reason.trim().length > 0 &&
    Number.isInteger(numericPoints) &&
    numericPoints > 0
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Puntos de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Consulta y ajusta los puntos de clientes habituales. Los pagos de reservas con cliente
            identificado suman un punto por euro; los ajustes y canjes quedan registrados.
          </p>
          {feedback ? <output className="mt-2 block text-sm">{feedback}</output> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <output aria-busy="true" className="text-muted-foreground text-sm">
              Cargando clientes…
            </output>
          ) : loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-3" role="alert">
              <span className="text-destructive text-sm">{loadError}</span>
              <Button onClick={() => void load()} size="sm" type="button" variant="outline">
                Reintentar
              </Button>
            </div>
          ) : guests.length ? (
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
          {guests.length > 0 && (hasMore || page > 1) ? (
            <div className="mt-4 flex items-center justify-between">
              <Button
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
                variant="outline"
              >
                Anterior
              </Button>
              <span className="text-muted-foreground text-sm">Página {page}</span>
              <Button
                disabled={!hasMore}
                onClick={() => setPage((current) => current + 1)}
                type="button"
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          ) : null}
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
            <Button
              disabled={pendingAction || !canSaveAdjustment}
              onClick={() => void save()}
              type="button"
            >
              {pendingAction ? 'Guardando…' : 'Guardar ajuste'}
            </Button>
            <Button
              disabled={pendingAction || !canRedeem}
              onClick={() => void redeem()}
              type="button"
              variant="outline"
            >
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
