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

import type { FiscalSettingsView } from '../application/invoice'
import { createInvoiceSeries, upsertFiscalSettings } from '../application/invoice'
import type { VerifactuEnv } from '../domain/invoice'
import { formatInvoiceReference } from '../domain/invoice'

const CURRENT_YEAR = new Date().getFullYear()

/** Billing cockpit: fiscal identity, series and the invoice book. */
export function BillingPage({
  locale,
  onDone,
  overview,
  tenantId,
}: {
  locale: Locale
  onDone: () => void
  overview: FiscalSettingsView
  tenantId: string
}) {
  return (
    <section className="space-y-6">
      <FiscalSettingsCard locale={locale} onDone={onDone} settings={overview.settings} tenantId={tenantId} />
      <SeriesCard onDone={onDone} series={overview.series} tenantId={tenantId} />
      <InvoiceBookCard invoices={overview.invoices} locale={locale} />
    </section>
  )
}

function FiscalSettingsCard({
  locale,
  onDone,
  settings,
  tenantId,
}: {
  locale: Locale
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
      .catch(() => feedback.setError('No se han podido guardar los datos fiscales.'))
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
            <Input id="fiscal-nif" onChange={(event) => setIssuerNif(event.target.value)} required value={issuerNif} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-name">Razón social</FieldLabel>
            <Input id="fiscal-name" onChange={(event) => setLegalName(event.target.value)} required value={legalName} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-address">Domicilio</FieldLabel>
            <Input id="fiscal-address" onChange={(event) => setAddressLine(event.target.value)} required value={addressLine} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-city">Población</FieldLabel>
            <Input id="fiscal-city" onChange={(event) => setCity(event.target.value)} required value={city} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-postal">Código postal</FieldLabel>
            <Input id="fiscal-postal" inputMode="numeric" onChange={(event) => setPostalCode(event.target.value)} required value={postalCode} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fiscal-country">País</FieldLabel>
            <Input id="fiscal-country" maxLength={2} onChange={(event) => setCountryCode(event.target.value)} required value={countryCode} />
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
        <CardDescription>La correlatividad se reserva de forma atómica en la base de datos.</CardDescription>
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
            <Input id="series-code" onChange={(event) => setCode(event.target.value)} required value={code} />
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

function InvoiceBookCard({ invoices, locale }: { invoices: FiscalSettingsView['invoices']; locale: Locale }) {
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
