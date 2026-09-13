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

import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'
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
  const locale = useLocale('es')
  const t = createTranslator(locale)
  const feedback = useFormFeedback()
  const [emailFromName, setEmailFromName] = useState(branding?.emailFromName ?? defaultName)
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? '')
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? '#0f766e')
  const [accentColor, setAccentColor] = useState(branding?.accentColor ?? '#c34d3e')
  const [preset, setPreset] = useState<EmailBranding['preset']>(branding?.preset ?? 'terracotta')
  const [replyToEmail, setReplyToEmail] = useState(branding?.replyToEmail ?? '')
  const [logoUploadState, setLogoUploadState] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle',
  )
  const uploadingLogo = logoUploadState === 'pending'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending || uploadingLogo) return
    feedback.setPending()
    void saveEmailBranding({
      data: { emailFromName, logoUrl, primaryColor, accentColor, preset, replyToEmail, tenantId },
    })
      .then(() => feedback.setSuccess(t('communications.branding.saveSuccess')))
      .catch(() => feedback.setError(t('communications.branding.saveError')))
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || uploadingLogo) return
    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadState('error')
      return
    }
    setLogoUploadState('pending')
    try {
      const client = createBrowserSupabaseClient()
      const path = `${tenantId}/logo-${Date.now()}.${file.name.split('.').pop() ?? 'png'}`
      const result = await client.storage
        .from('tenant_logos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (result.error) throw result.error
      setLogoUrl(client.storage.from('tenant_logos').getPublicUrl(path).data.publicUrl)
      setLogoUploadState('success')
    } catch {
      setLogoUploadState('error')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('communications.branding.title')}</PageHeaderTitle>
          <PageHeaderDescription>{t('communications.branding.description')}</PageHeaderDescription>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>{t('communications.branding.cardTitle')}</CardTitle>
          <CardDescription>{t('communications.branding.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            aria-busy={feedback.pending || uploadingLogo}
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={submit}
          >
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="theme-preset">{t('communications.branding.preset')}</FieldLabel>
              <select
                className="focus-visible:outline-ring min-h-10 rounded-md border px-3 focus-visible:outline-2 focus-visible:outline-offset-2"
                disabled={!canManage || feedback.pending || uploadingLogo}
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
                <option value="terracotta">{t('communications.branding.preset.terracotta')}</option>
                <option value="olive">{t('communications.branding.preset.olive')}</option>
                <option value="ocean">{t('communications.branding.preset.ocean')}</option>
                <option value="midnight">{t('communications.branding.preset.midnight')}</option>
                <option value="custom">{t('communications.branding.preset.custom')}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="email-from-name">
                {t('communications.branding.senderName')}
              </FieldLabel>
              <Input
                disabled={!canManage || feedback.pending || uploadingLogo}
                id="email-from-name"
                maxLength={120}
                onChange={(event) => setEmailFromName(event.target.value)}
                required
                value={emailFromName}
              />
              {canManage ? (
                <div className="mt-3 space-y-2">
                  <FieldLabel htmlFor="logo-upload">
                    {t('communications.branding.logoUpload')}
                  </FieldLabel>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="file:bg-muted block text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:font-medium disabled:opacity-60"
                    disabled={feedback.pending || uploadingLogo}
                    id="logo-upload"
                    onChange={(event) => void uploadLogo(event)}
                    type="file"
                  />
                  {logoUploadState !== 'idle' ? (
                    <output
                      aria-live="polite"
                      className={
                        logoUploadState === 'error'
                          ? 'text-destructive block text-xs'
                          : 'text-muted-foreground block text-xs'
                      }
                    >
                      {logoUploadState === 'pending'
                        ? t('communications.branding.logoUploading')
                        : logoUploadState === 'success'
                          ? t('communications.branding.logoUploaded')
                          : t('communications.branding.logoUploadError')}
                    </output>
                  ) : null}
                </div>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="accent-color">
                {t('communications.branding.accentColor')}
              </FieldLabel>
              <input
                aria-label={t('communications.branding.accentColorPicker')}
                className="size-10 cursor-pointer rounded border p-1"
                disabled={!canManage || feedback.pending || uploadingLogo}
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
              <FieldLabel htmlFor="reply-to-email">
                {t('communications.branding.replyToEmail')}
              </FieldLabel>
              <Input
                disabled={!canManage || feedback.pending || uploadingLogo}
                id="reply-to-email"
                onChange={(event) => setReplyToEmail(event.target.value)}
                placeholder="reservas@turestaurante.es"
                type="email"
                value={replyToEmail}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="logo-url">{t('communications.branding.logoUrl')}</FieldLabel>
              <Input
                disabled={!canManage || feedback.pending || uploadingLogo}
                id="logo-url"
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://…/logo.png"
                type="url"
                value={logoUrl}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="primary-color">
                {t('communications.branding.primaryColor')}
              </FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  aria-label={t('communications.branding.primaryColorPicker')}
                  className="size-10 cursor-pointer rounded border p-1"
                  disabled={!canManage || feedback.pending || uploadingLogo}
                  id="primary-color"
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  type="color"
                  value={primaryColor}
                />
                <Input
                  aria-label={t('communications.branding.primaryColorValue')}
                  disabled={!canManage || feedback.pending || uploadingLogo}
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
                {t('communications.branding.preview')}
              </p>
            </div>
            {canManage ? (
              <div className="sm:col-span-2">
                <Button disabled={feedback.pending || uploadingLogo} type="submit">
                  {feedback.pending
                    ? t('communications.branding.saving')
                    : t('communications.branding.save')}
                </Button>
              </div>
            ) : null}
          </form>
          <FormFeedback pendingLabel={t('communications.branding.saving')} state={feedback.state} />
        </CardContent>
      </Card>
    </section>
  )
}
