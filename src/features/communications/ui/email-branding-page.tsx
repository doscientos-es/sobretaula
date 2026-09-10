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
import { useState, type FormEvent } from 'react'

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
  const [replyToEmail, setReplyToEmail] = useState(branding?.replyToEmail ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    void saveEmailBranding({
      data: { emailFromName, logoUrl, primaryColor, replyToEmail, tenantId },
    })
      .then(() => feedback.setSuccess('Identidad de correo guardada.'))
      .catch(() => feedback.setError('No se ha podido guardar la identidad de correo.'))
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
            <div className="rounded-xl border p-4 sm:mt-6" style={{ borderColor: primaryColor }}>
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
