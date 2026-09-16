import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
} from '@doscientos/ui'
import { useCallback, useState, type FormEvent } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import {
  createGuestCampaign,
  listGuestCampaigns,
  updateGuestCampaignStatus,
  type CampaignSummary,
} from '../application/campaigns'

export function CampaignsPage({ tenantId }: { tenantId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listGuestCampaigns({ data: { page, pageSize: 25, tenantId } })
      setCampaigns(result.items)
      setTotal(result.total)
    } catch {
      setLoadError('No se han podido cargar las campañas.')
    } finally {
      setLoading(false)
    }
  }, [page, tenantId])
  useAsyncEffect(load, [load])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const value = (name: string, fallback: string) => {
      const field = values.get(name)
      return typeof field === 'string' ? field : fallback
    }
    setFeedback(null)
    if (!value('name', '').trim()) {
      setFeedback('Indica un nombre para la campaña.')
      return
    }
    if (pendingAction) return
    setPendingAction('save')
    try {
      await createGuestCampaign({
        data: {
          tenantId,
          name: value('name', ''),
          channel: value('channel', 'email') as 'email' | 'sms' | 'whatsapp',
          segment: value('segment', 'inactivo') as 'vip' | 'habitual' | 'inactivo' | 'nuevo',
        },
      })
      setFeedback('Campaña guardada como borrador.')
      event.currentTarget.reset()
      setPage(1)
    } catch {
      setFeedback('No se ha podido crear la campaña.')
    } finally {
      setPendingAction(null)
    }
  }
  async function sendCampaign(campaignId: string) {
    setFeedback(null)
    if (pendingAction) return
    setPendingAction(campaignId)
    try {
      await updateGuestCampaignStatus({ data: { tenantId, campaignId, status: 'sent' } })
      setFeedback('Campaña enviada a los contactos con consentimiento.')
      await load()
    } catch {
      setFeedback('No se ha podido enviar la campaña.')
    } finally {
      setPendingAction(null)
    }
  }
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nueva campaña</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void submit(event)}>
            <Field>
              <FieldLabel htmlFor="campaign-name">Nombre</FieldLabel>
              <Input
                id="campaign-name"
                name="name"
                placeholder="Recuperar clientes inactivos"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="campaign-segment">Segmento</FieldLabel>
              <select
                className="border-input h-10 rounded-md border bg-transparent px-3"
                id="campaign-segment"
                name="segment"
                defaultValue="inactivo"
              >
                <option value="inactivo">Inactivos</option>
                <option value="habitual">Habituales</option>
                <option value="vip">VIP</option>
                <option value="nuevo">Nuevos</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="campaign-channel">Canal</FieldLabel>
              <select
                className="border-input h-10 rounded-md border bg-transparent px-3"
                id="campaign-channel"
                name="channel"
                defaultValue="email"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Button disabled={pendingAction !== null} type="submit">
                {pendingAction === 'save' ? 'Guardando…' : 'Guardar borrador'}
              </Button>
            </div>
          </form>
          {feedback && <output className="mt-3 block text-sm">{feedback}</output>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Campañas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Cargando…</p>
          ) : loadError ? (
            <div
              className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              role="alert"
            >
              <span className="text-destructive">{loadError}</span>
              <Button onClick={() => void load()} size="sm" type="button" variant="outline">
                Reintentar
              </Button>
            </div>
          ) : campaigns.length ? (
            <ul className="space-y-2">
              {campaigns.map((campaign) => (
                <li
                  className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm"
                  key={campaign.id}
                >
                  <span className="font-medium">
                    {campaign.name} · {campaign.channel}
                  </span>
                  <span className="text-muted-foreground">
                    {campaign.status} · {campaign.recipients} destinatarios ·{' '}
                    {(campaign.attributedRevenueCents / 100).toFixed(2)} € atribuibles
                  </span>
                  {campaign.status === 'draft' ? (
                    <Button
                      disabled={pendingAction !== null}
                      onClick={() => void sendCampaign(campaign.id)}
                      size="sm"
                      type="button"
                    >
                      {pendingAction === campaign.id ? 'Enviando…' : 'Marcar enviada'}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Todavía no hay campañas.</p>
              <Button
                onClick={() => document.getElementById('campaign-name')?.focus()}
                size="sm"
                type="button"
                variant="outline"
              >
                Crear primera campaña
              </Button>
            </div>
          )}
          {total > 25 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{total} campañas</span>
              <div className="flex gap-2">
                <Button
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                  size="sm"
                  type="button"
                >
                  Anteriores
                </Button>
                <Button
                  disabled={page * 25 >= total}
                  onClick={() => setPage((value) => value + 1)}
                  size="sm"
                  type="button"
                >
                  Siguientes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
