import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@doscientos/ui'
import { useCallback, useEffect, useState } from 'react'

import {
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
  const load = useCallback(async () => {
    try {
      setCards(await listGiftCards({ data: { tenantId } }))
    } catch {
      setFeedback('No se han podido cargar las tarjetas.')
    }
  }, [tenantId])
  useEffect(() => {
    void load()
  }, [load])
  async function run(action: 'issue' | 'redeem') {
    const value = Number(amount)
    if (!code.trim() || !Number.isInteger(value) || value <= 0) return
    try {
      if (action === 'issue') await issueGiftCard({ data: { tenantId, code, amountCents: value } })
      else await redeemGiftCard({ data: { tenantId, code, amountCents: value } })
      setFeedback(action === 'issue' ? 'Tarjeta emitida.' : 'Tarjeta canjeada.')
      setCode('')
      setAmount('')
      await load()
    } catch {
      setFeedback(
        action === 'issue' ? 'No se ha podido emitir.' : 'Saldo insuficiente o tarjeta no válida.',
      )
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              aria-label="Código de tarjeta"
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código"
              value={code}
            />
            <Input
              aria-label="Importe en céntimos"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Importe en céntimos"
              type="number"
              value={amount}
            />
            <Button onClick={() => void run('issue')} type="button">
              Emitir
            </Button>
            <Button onClick={() => void run('redeem')} type="button" variant="outline">
              Canjear
            </Button>
          </div>
          {feedback ? <output className="mt-2 block text-sm">{feedback}</output> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <ul className="divide-border divide-y">
            {cards.map((card) => (
              <li className="flex justify-between py-3 text-sm" key={card.id}>
                <span className="font-medium">{card.code}</span>
                <span>
                  {(card.balanceCents / 100).toFixed(2)} € de{' '}
                  {(card.initialBalanceCents / 100).toFixed(2)} € · {card.status}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
