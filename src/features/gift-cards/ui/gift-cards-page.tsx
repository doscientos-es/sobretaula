import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@doscientos/ui'
import { useCallback, useState } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import {
  cancelGiftCard,
  issueGiftCard,
  listGiftCards,
  redeemGiftCard,
  type GiftCard,
} from '../application/gift-cards'
export function GiftCardsPage({ tenantId }: { tenantId: string }) {
  const [cards, setCards] = useState<GiftCard[]>([])
  const [code, setCode] = useState('')
  const [amount, setAmount] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [pendingAction, setPendingAction] = useState<'issue' | 'redeem' | null>(null)
  const load = useCallback(
    async (requestedPage = page, requestedSearch = search) => {
      try {
        const result = await listGiftCards({
          data: {
            tenantId,
            page: requestedPage,
            pageSize: 25,
            search: requestedSearch,
          },
        })
        setCards(result.items)
        setHasMore(result.hasMore)
      } catch {
        setFeedback('No se han podido cargar las tarjetas.')
      }
    },
    [page, search, tenantId],
  )
  useAsyncEffect(load, [load])
  async function run(action: 'issue' | 'redeem') {
    const euros = Number(amount.replace(',', '.'))
    const value = Math.round(euros * 100)
    if (code.trim().length < 4 || !Number.isFinite(euros) || euros <= 0 || value <= 0) {
      setFeedback('Introduce un código de al menos 4 caracteres y un importe mayor que 0.')
      return
    }
    setPendingAction(action)
    try {
      if (action === 'issue') await issueGiftCard({ data: { tenantId, code, amountCents: value } })
      else await redeemGiftCard({ data: { tenantId, code, amountCents: value } })
      setFeedback(action === 'issue' ? 'Tarjeta emitida.' : 'Tarjeta canjeada.')
      setCode('')
      setAmount('')
      await load(1)
      setPage(1)
    } catch (error) {
      setFeedback(
        action === 'issue'
          ? error instanceof Error && error.message.includes('23505')
            ? 'Ese código ya existe. Usa otro código para emitir la tarjeta.'
            : error instanceof Error && error.message.includes('Forbidden')
              ? 'Tu rol no permite emitir tarjetas regalo.'
              : 'No se ha podido emitir la tarjeta. Revisa los datos e inténtalo de nuevo.'
          : 'Saldo insuficiente o tarjeta no válida.',
      )
    } finally {
      setPendingAction(null)
    }
  }
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tarjetas regalo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Emite ingresos por adelantado y controla cada canje con saldo real.
          </p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void run('issue')
            }}
          >
            <Input
              aria-label="Código de tarjeta"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código"
              required
              value={code}
            />
            <Input
              aria-label="Importe en euros"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Importe en euros"
              inputMode="decimal"
              max="10000"
              min="0.01"
              required
              step="0.01"
              type="text"
              value={amount}
            />
            <Button disabled={pendingAction !== null} type="submit">
              {pendingAction === 'issue' ? 'Emitiendo…' : 'Emitir'}
            </Button>
            <Button
              disabled={pendingAction !== null}
              onPress={() => void run('redeem')}
              type="button"
              variant="outline"
            >
              {pendingAction === 'redeem' ? 'Canjeando…' : 'Canjear'}
            </Button>
          </form>
          {feedback ? <output className="mt-2 block text-sm">{feedback}</output> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <Input
            aria-label="Buscar tarjetas"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por código"
            value={search}
          />
          <ul className="divide-border divide-y">
            {cards.map((card) => (
              <li className="flex justify-between py-3 text-sm" key={card.id}>
                <span className="font-medium">{card.code}</span>
                <span className="flex items-center gap-2">
                  {(card.balanceCents / 100).toFixed(2)} € de{' '}
                  {(card.initialBalanceCents / 100).toFixed(2)} € · {card.status}
                  {card.status === 'active' ? (
                    <Button
                      onClick={() =>
                        void cancelGiftCard({
                          data: { tenantId, cardId: card.id },
                        }).then(() => load())
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Anular
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
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
        </CardContent>
      </Card>
    </section>
  )
}
