import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney } from '@/shared/lib/money/money'

import {
  createInvoiceSeries,
  getInvoiceDocument,
  upsertFiscalSettings,
  type FiscalSettingsView,
} from '../application/invoice'
import type { VerifactuEnv } from '../domain/invoice'

const CURRENT_YEAR = new Date().getFullYear()

function fiscalErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  const messages: Record<string, string> = {
    fiscal_settings_invalid_address: 'Indica una dirección fiscal válida.',
    fiscal_settings_invalid_city: 'Indica una población válida.',
    fiscal_settings_invalid_country: 'Usa un código de país de dos letras, por ejemplo ES.',
    fiscal_settings_invalid_nif: 'Revisa el NIF/CIF introducido.',
    fiscal_settings_invalid_postal_code: 'El código postal debe tener 5 cifras.',
    fiscal_settings_invalid_legal_name: 'Indica la razón social.',
  }
  return (
    messages[code] ??
    'No se han podido guardar los datos fiscales. Revisa los campos e inténtalo de nuevo.'
  )
}

/** Billing cockpit: fiscal identity, series and the invoice book. */
export function BillingPage({
  locale,
  onDone,
  overview,
  isOwner,
  tenantId,
}: {
  locale: Locale
  onDone: () => void
  overview: FiscalSettingsView
  isOwner: boolean
  tenantId: string
}) {
  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Facturación</PageHeaderTitle>
          <PageHeaderDescription>
            Configura la identidad de emisión, las series y el libro de facturas del restaurante.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <FiscalSettingsCard onDone={onDone} settings={overview.settings} tenantId={tenantId} />
      <VerifactuCertificateCard
        certificate={overview.certificate}
        isOwner={isOwner}
        onDone={onDone}
        settings={overview.settings}
        tenantId={tenantId}
      />
      <SeriesCard onDone={onDone} series={overview.series} tenantId={tenantId} />
      <InvoiceBookCard invoices={overview.invoices} locale={locale} tenantId={tenantId} />
    </section>
  )
}

function VerifactuCertificateCard({
  certificate,
  isOwner,
  onDone,
  settings,
  tenantId,
}: {
  certificate: FiscalSettingsView['certificate']
  isOwner: boolean
  onDone: () => void
  settings: FiscalSettingsView['settings']
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending || !file) return
    feedback.setPending()
    const body = new FormData()
    body.set('certificate', file)
    body.set('password', password)
    try {
      const response = await fetch(`/api/t/${tenantId}/verifactu-certificate`, {
        body,
        credentials: 'same-origin',
        method: 'POST',
      })
      if (!response.ok) {
        const code = await response.text()
        const message = {
          certificate_expired: 'El certificado está caducado.',
          certificate_invalid:
            'No se ha podido abrir el certificado. Revisa el archivo y la contraseña.',
          certificate_nif_mismatch:
            'El NIF del certificado no coincide con el NIF fiscal guardado.',
          fiscal_settings_missing: 'Guarda primero los datos fiscales del emisor.',
        }[code]
        throw new Error(message ?? 'No se ha podido guardar el certificado.')
      }
      setFile(null)
      setPassword('')
      feedback.setSuccess('Certificado validado y guardado de forma cifrada.')
      onDone()
    } catch (error) {
      feedback.setError(
        error instanceof Error ? error.message : 'No se ha podido guardar el certificado.',
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificado VERI*FACTU</CardTitle>
        <CardDescription>
          {certificate
            ? `Configurado para ${certificate.subject}; caduca el ${new Date(certificate.expiresAt).toLocaleDateString('es-ES')}.`
            : 'Sube el certificado .pfx o .p12 del emisor para poder operar con VERI*FACTU.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {certificate && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Huella SHA-256</dt>
              <dd className="font-mono text-xs break-all">{certificate.fingerprint}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Titular</dt>
              <dd>{certificate.subject}</dd>
            </div>
          </dl>
        )}
        {!settings ? (
          <p className="text-muted-foreground text-sm">
            Completa primero los datos fiscales del emisor que aparecen arriba.
          </p>
        ) : !isOwner ? (
          <p className="text-muted-foreground text-sm">
            Solo la persona propietaria puede cambiar el certificado.
          </p>
        ) : (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void upload(event)}>
            <Field>
              <FieldLabel htmlFor="verifactu-certificate">Archivo .pfx o .p12</FieldLabel>
              <Input
                accept=".pfx,.p12,application/x-pkcs12"
                id="verifactu-certificate"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
                type="file"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="verifactu-password">Contraseña del certificado</FieldLabel>
              <Input
                autoComplete="new-password"
                id="verifactu-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button disabled={feedback.pending || !file} type="submit">
                {certificate ? 'Reemplazar certificado' : 'Guardar certificado'}
              </Button>
              <AdvisorCertificateDialog />
              <FormFeedback
                pendingLabel="Validando y cifrando certificado…"
                state={feedback.state}
              />
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function AdvisorCertificateDialog() {
  const [copied, setCopied] = useState(false)
  const message =
    'Necesito el certificado digital de la empresa en formato .pfx o .p12 y su contraseña para configurar VERI*FACTU en SobreTaula. Debe corresponder al NIF fiscal con el que emitimos las facturas. Por favor, envíamelo por un canal seguro.'

  async function copyMessage() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
  }

  return (
    <Dialog trigger="Pedir a tu asesor" triggerProps={{ type: 'button', variant: 'outline' }}>
      <DialogHeader>
        <DialogTitle>Solicita el certificado a tu asesor</DialogTitle>
        <DialogDescription>
          El certificado y su contraseña permiten firmar en nombre de tu empresa. Compártelos solo
          por un canal seguro.
        </DialogDescription>
      </DialogHeader>
      <p className="rounded-md border p-3 text-sm leading-6">
        Copia este texto y pásaselo a tu asesor:
      </p>
      <blockquote className="bg-muted rounded-md p-3 text-sm leading-6">{message}</blockquote>
      <DialogFooter>
        <Button onPress={() => void copyMessage()} type="button">
          {copied ? 'Texto copiado' : 'Copiar texto'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function FiscalSettingsCard({
  onDone,
  settings,
  tenantId,
}: {
  onDone: () => void
  settings: FiscalSettingsView['settings']
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [issuerNif, setIssuerNif] = useState(settings?.issuerNif ?? '')
  const [legalName, setLegalName] = useState(settings?.legalName ?? '')
  const [addressLine, setAddressLine] = useState(settings?.addressLine ?? '')
  const [city, setCity] = useState(settings?.city ?? '')
  const [postalCode, setPostalCode] = useState(settings?.postalCode ?? '')
  const [countryCode, setCountryCode] = useState(settings?.countryCode ?? 'ES')
  const [environment, setEnvironment] = useState<VerifactuEnv>(settings?.environment ?? 'test')

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return
    feedback.setPending()
    void upsertFiscalSettings({
      data: {
        addressLine,
        city,
        countryCode,
        environment,
        issuerNif,
        legalName,
        postalCode,
        tenantId,
      },
    })
      .then(onDone)
      .catch((error) => feedback.setError(fiscalErrorMessage(error)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos fiscales del emisor</CardTitle>
        <CardDescription>
          Identidad fiscal con la que el restaurante emite sus facturas (modo {environment}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
          <Field>
            <FieldLabel htmlFor="fiscal-nif">NIF</FieldLabel>
            <Input
              id="fiscal-nif"
              onChange={(event) => setIssuerNif(event.target.value)}
              required
              value={issuerNif}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-name">Razón social</FieldLabel>
            <Input
              id="fiscal-name"
              onChange={(event) => setLegalName(event.target.value)}
              required
              value={legalName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-address">Domicilio</FieldLabel>
            <Input
              id="fiscal-address"
              onChange={(event) => setAddressLine(event.target.value)}
              required
              value={addressLine}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-city">Población</FieldLabel>
            <Input
              id="fiscal-city"
              onChange={(event) => setCity(event.target.value)}
              required
              value={city}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-postal">Código postal</FieldLabel>
            <Input
              id="fiscal-postal"
              inputMode="numeric"
              onChange={(event) => setPostalCode(event.target.value)}
              required
              value={postalCode}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-country">País</FieldLabel>
            <Input
              id="fiscal-country"
              maxLength={2}
              onChange={(event) => setCountryCode(event.target.value)}
              required
              value={countryCode}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-env">Entorno VERI*FACTU</FieldLabel>
            <select
              id="fiscal-env"
              onChange={(event) => setEnvironment(event.target.value as VerifactuEnv)}
              value={environment}
            >
              <option value="test">Pruebas (test)</option>
              <option value="prod">Producción (prod)</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <FormFeedback pendingLabel="Guardando datos fiscales…" state={feedback.state} />
            <Button disabled={feedback.pending} type="submit">
              Guardar datos fiscales
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function SeriesCard({
  onDone,
  series,
  tenantId,
}: {
  onDone: () => void
  series: FiscalSettingsView['series']
  tenantId: string
}) {
  const feedback = useFormFeedback()
  const [code, setCode] = useState(`A-${CURRENT_YEAR}`)
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR)

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return
    feedback.setPending()
    void createInvoiceSeries({ data: { code, fiscalYear, tenantId } })
      .then(onDone)
      .catch(() => feedback.setError('No se ha podido crear la serie. ¿Está duplicada?'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Series de facturación</CardTitle>
        <CardDescription>
          La correlatividad se reserva de forma atómica en la base de datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {series.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serie</TableHead>
                <TableHead>Ejercicio</TableHead>
                <TableHead>Siguiente número</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.fiscalYear}</TableCell>
                  <TableCell className="tabular-nums">{item.nextNumber}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
          <Field>
            <FieldLabel htmlFor="series-code">Código</FieldLabel>
            <Input
              id="series-code"
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="series-year">Ejercicio</FieldLabel>
            <Input
              id="series-year"
              max={2100}
              min={2000}
              onChange={(event) => setFiscalYear(Number(event.target.value))}
              required
              type="number"
              value={fiscalYear}
            />
          </Field>
          <Button disabled={feedback.pending} type="submit">
            Crear serie
          </Button>
        </form>
        <FormFeedback pendingLabel="Creando serie…" state={feedback.state} />
      </CardContent>
    </Card>
  )
}

function InvoiceBookCard({
  invoices,
  locale,
  tenantId,
}: {
  invoices: FiscalSettingsView['invoices']
  locale: Locale
  tenantId: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Libro de facturas</CardTitle>
        <CardDescription>Últimas facturas emitidas (máx. 100).</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no hay facturas emitidas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>
                  <span className="sr-only">Descargar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.fullNumber}</TableCell>
                  <TableCell>{new Date(invoice.issuedAt).toLocaleDateString(locale)}</TableCell>
                  <TableCell>{invoice.customerName ?? '—'}</TableCell>
                  <TableCell>{invoice.status}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(invoice.totalGross, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <InvoiceDownloadButton invoiceId={invoice.id} tenantId={tenantId} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function InvoiceDownloadButton({ invoiceId, tenantId }: { invoiceId: string; tenantId: string }) {
  const feedback = useFormFeedback()

  function download() {
    if (feedback.pending) return
    feedback.setPending()
    void getInvoiceDocument({ data: { invoiceId, tenantId } })
      .then((result) => {
        feedback.reset()
        window.open(result.signedUrl, '_blank', 'noopener,noreferrer')
      })
      .catch(() => {
        feedback.setError('Aún no hay PDF disponible para esta factura.')
      })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <FormFeedback pendingLabel="Preparando PDF…" state={feedback.state} />
      <Button onClick={download} size="sm" type="button" variant="ghost">
        Descargar PDF
      </Button>
    </span>
  )
}
