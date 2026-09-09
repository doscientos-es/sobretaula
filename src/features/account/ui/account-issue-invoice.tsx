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
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { issueInvoiceFromSession, type InvoiceSeries } from '@/features/invoices'
import type { Locale } from '@/shared/lib/i18n/locale'

/** Emits the fiscal invoice of a closed, fully paid session. */
export function AccountIssueInvoice({
  disabled,
  locale: _locale,
  sessionId,
  series,
  tenantId,
  venueId,
}: {
  disabled: boolean
  locale: Locale
  sessionId: string
  series: InvoiceSeries[]
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? '')
  const [customerName, setCustomerName] = useState('')
  const [customerNif, setCustomerNif] = useState('')

  function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return
    if (!seriesId) {
      feedback.setError('Crea primero una serie de facturación en Facturación.')
      return
    }
    feedback.setPending()
    void issueInvoiceFromSession({
      data: {
        ...(customerName ? { customerName } : {}),
        ...(customerNif ? { customerNif } : {}),
        seriesId,
        sessionId,
        tenantId,
        venueId,
      },
    })
      .then((result) => {
        feedback.setSuccess(`Factura ${result.fullNumber} emitida.`)
      })
      .catch(() => feedback.setError('No se ha podido emitir la factura.'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emitir factura</CardTitle>
        <CardDescription>
          Factura fiscal de la sesión en entorno de pruebas VERI*FACTU.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={issue}>
          <Field>
            <FieldLabel htmlFor="issue-series">Serie</FieldLabel>
            <select
              id="issue-series"
              onChange={(event) => setSeriesId(event.target.value)}
              value={seriesId}
            >
              {series.map((item) => (
                <option key={item.id} value={item.id}>
                  {`${item.code} · ejercicio ${item.fiscalYear}`}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="issue-customer-name">Cliente (opcional)</FieldLabel>
            <Input
              id="issue-customer-name"
              onChange={(event) => setCustomerName(event.target.value)}
              value={customerName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="issue-customer-nif">NIF del cliente (opcional)</FieldLabel>
            <Input
              id="issue-customer-nif"
              onChange={(event) => setCustomerNif(event.target.value)}
              value={customerNif}
            />
          </Field>
          <FormFeedback pendingLabel="Emitiendo factura…" state={feedback.state} />
          <Button disabled={disabled || feedback.pending || series.length === 0} type="submit">
            Emitir factura
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
