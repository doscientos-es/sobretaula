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
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type ChangeEvent, type FormEvent } from 'react'

import { createBrowserSupabaseClient } from '@/shared/lib/supabase/client'

import { saveEmailBranding, type EmailBranding } from '../application/email-branding'

export function EmailBrandingPage({
  branding,
  canManage,
  defaultName,
  tenantId,
}: {
  branding: EmailBranding | null
  canManage: boolean
  defaultName: string
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [emailFromName, setEmailFromName] = useState(branding?.emailFromName ?? defaultName)
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? '')
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? '#0f766e')
  const [accentColor, setAccentColor] = useState(branding?.accentColor ?? '#c34d3e')
  const [preset, setPreset] = useState<EmailBranding['preset']>(branding?.preset ?? 'terracotta')
  const [replyToEmail, setReplyToEmail] = useState(branding?.replyToEmail ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    void saveEmailBranding({
      data: { emailFromName, logoUrl, primaryColor, accentColor, preset, replyToEmail, tenantId },
    })
      .then(() => feedback.setSuccess('Identidad de correo guardada.'))
      .catch(() => feedback.setError('No se ha podido guardar la identidad de correo.'))
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      feedback.setError('El logo no puede superar 2 MB.')
      return
    }
    const client = createBrowserSupabaseClient()
    const path = `${tenantId}/logo-${Date.now()}.${file.name.split('.').pop() ?? 'png'}`
    const result = await client.storage
      .from('tenant_logos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (result.error) {
      feedback.setError('No se ha podido subir el logo.')
      return
    }
    setLogoUrl(client.storage.from('tenant_logos').getPublicUrl(path).data.publicUrl)
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Comunicaciones</PageHeaderTitle>
          <PageHeaderDescription>
            Personaliza los correos de confirmación que reciben tus clientes.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Identidad de los correos</CardTitle>
          <CardDescription>
            El nombre se muestra como remitente. El envío sale desde el dominio seguro de
            SobreTaula.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5 sm:grid-cols-2" onSubmit={submit}>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="theme-preset">Estilo rápido</FieldLabel>
              <select
                className="min-h-10 rounded-md border px-3"
                disabled={!canManage}
                id="theme-preset"
                onChange={(event) => {
                  const value = event.target.value as EmailBranding['preset']
                  setPreset(value)
                  const colors = {
                    terracotta: ['#0f766e', '#c34d3e'],
                    olive: ['#556b2f', '#b7791f'],
                    ocean: ['#1769aa', '#0e7490'],
                    midnight: ['#312e81', '#db2777'],
                    custom: [primaryColor, accentColor],
                  } as const
                  const selected = colors[value]
                  if (selected) {
                    setPrimaryColor(selected[0])
                    setAccentColor(selected[1])
                  }
                }}
                value={preset}
              >
                <option value="terracotta">Terracota · cálido</option>
                <option value="olive">Oliva · natural</option>
                <option value="ocean">Océano · fresco</option>
                <option value="midnight">Medianoche · elegante</option>
                <option value="custom">Personalizado</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="email-from-name">Nombre del remitente</FieldLabel>
              <Input
                disabled={!canManage}
                id="email-from-name"
                maxLength={120}
                onChange={(event) => setEmailFromName(event.target.value)}
                required
                value={emailFromName}
              />
              {canManage ? (
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="mt-2 block text-sm"
                  type="file"
                  onChange={(event) => void uploadLogo(event)}
                />
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="accent-color">Color de acento</FieldLabel>
              <input
                aria-label="Selector de color de acento"
                className="size-10 cursor-pointer rounded border p-1"
                disabled={!canManage}
                id="accent-color"
                onChange={(event) => {
                  setAccentColor(event.target.value)
                  setPreset('custom')
                }}
                type="color"
                value={accentColor}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="reply-to-email">Correo de respuesta</FieldLabel>
              <Input
                disabled={!canManage}
                id="reply-to-email"
                onChange={(event) => setReplyToEmail(event.target.value)}
                placeholder="reservas@turestaurante.es"
                type="email"
                value={replyToEmail}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="logo-url">URL pública del logo</FieldLabel>
              <Input
                disabled={!canManage}
                id="logo-url"
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://…/logo.png"
                type="url"
                value={logoUrl}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="primary-color">Color principal</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  aria-label="Selector de color principal"
                  className="size-10 cursor-pointer rounded border p-1"
                  disabled={!canManage}
                  id="primary-color"
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  type="color"
                  value={primaryColor}
                />
                <Input
                  aria-label="Código hexadecimal del color principal"
                  disabled={!canManage}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  pattern="#[0-9A-Fa-f]{6}"
                  value={primaryColor}
                />
              </div>
            </Field>
            <div className="rounded-xl border p-4 sm:mt-6" style={{ borderColor: accentColor }}>
              {logoUrl ? (
                <img
                  alt={`Logo de ${emailFromName || defaultName}`}
                  className="mb-3 h-8 max-w-40 object-contain object-left"
                  src={logoUrl}
                />
              ) : null}
              <p className="font-semibold" style={{ color: primaryColor }}>
                {emailFromName || defaultName}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Vista previa del encabezado del correo.
              </p>
            </div>
            {canManage ? (
              <div className="sm:col-span-2">
                <Button disabled={feedback.pending} type="submit">
                  Guardar identidad
                </Button>
              </div>
            ) : null}
          </form>
          <FormFeedback pendingLabel="Guardando identidad…" state={feedback.state} />
        </CardContent>
      </Card>
    </section>
  )
}
