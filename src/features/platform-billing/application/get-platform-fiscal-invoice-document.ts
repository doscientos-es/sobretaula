import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  createRequestSupabaseClient,
  createServiceSupabaseClient,
} from '@/shared/lib/supabase/server/create-server-client'

import {
  buildPlatformFiscalInvoicePdf,
  sha256,
} from '../infrastructure/server/platform-fiscal-invoice-pdf'

const input = z.object({ invoiceId: z.string().uuid(), tenantId: z.string().uuid() })
const storageBucket = 'invoice_documents'

/** Creates on first request and then serves a short-lived URL for the SaaS invoice PDF. */
export const getPlatformFiscalInvoiceDocument = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(input)
  .handler(async ({ context, data }) => {
    const requestSupabase = createRequestSupabaseClient(context.principal.accessToken)
    const { data: invoice, error: invoiceError } = await requestSupabase
      .from('platform_fiscal_invoices')
      .select(
        'id, tenant_id, platform_billing_invoice_id, customer_name, customer_nif, customer_address_line, customer_city, customer_postal_code, issued_at, issuer_nif, issuer_legal_name, issuer_address_line, issuer_city, issuer_postal_code, lines, period_start, period_end, subtotal_cents, vat_rate_bps, vat_cents, total_cents, full_number',
      )
      .eq('id', data.invoiceId)
      .eq('tenant_id', data.tenantId)
      .maybeSingle()
    if (invoiceError)
      throw new Error(`platform_fiscal_invoice_document_lookup_failed:${invoiceError.code}`)
    if (!invoice) throw new Response('Not found', { status: 404 })

    const { data: billing, error: billingError } = await requestSupabase
      .from('platform_billing_invoices')
      .select('paid_at, status')
      .eq('id', invoice.platform_billing_invoice_id)
      .single()
    if (billingError || !billing) throw new Response('Not found', { status: 404 })

    const supabase = createServiceSupabaseClient()
    const { data: existing, error: documentError } = await supabase
      .from('platform_fiscal_invoice_documents')
      .select('content_hash, object_path')
      .eq('platform_fiscal_invoice_id', invoice.id)
      .maybeSingle()
    if (documentError)
      throw new Error(`platform_fiscal_document_lookup_failed:${documentError.code}`)

    let document = existing
    if (!document) {
      const pdf = await buildPlatformFiscalInvoicePdf({
        customerAddressLine: invoice.customer_address_line,
        customerCity: invoice.customer_city,
        customerName: invoice.customer_name,
        customerNif: invoice.customer_nif,
        customerPostalCode: invoice.customer_postal_code,
        fullNumber: invoice.full_number,
        issuedAt: invoice.issued_at,
        issuerAddressLine: invoice.issuer_address_line,
        issuerCity: invoice.issuer_city,
        issuerLegalName: invoice.issuer_legal_name,
        issuerNif: invoice.issuer_nif,
        issuerPostalCode: invoice.issuer_postal_code,
        lines: invoice.lines,
        paidAt: billing.paid_at,
        paymentStatus: billing.status,
        periodEnd: invoice.period_end,
        periodStart: invoice.period_start,
        subtotalCents: invoice.subtotal_cents,
        totalCents: invoice.total_cents,
        vatCents: invoice.vat_cents,
        vatRateBps: invoice.vat_rate_bps,
      })
      const objectPath = `${invoice.tenant_id}/platform/${invoice.id}.pdf`
      const upload = await supabase.storage.from(storageBucket).upload(objectPath, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      })
      if (upload.error)
        throw new Error(`platform_fiscal_document_upload_failed:${upload.error.message}`)
      const { data: saved, error: saveError } = await supabase
        .from('platform_fiscal_invoice_documents')
        .upsert(
          {
            content_hash: sha256(pdf),
            object_path: objectPath,
            platform_fiscal_invoice_id: invoice.id,
            tenant_id: invoice.tenant_id,
          },
          { onConflict: 'platform_fiscal_invoice_id' },
        )
        .select('content_hash, object_path')
        .single()
      if (saveError || !saved)
        throw new Error(`platform_fiscal_document_save_failed:${saveError?.code ?? 'unknown'}`)
      document = saved
    }

    const signed = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(document.object_path, 300)
    if (signed.error || !signed.data?.signedUrl)
      throw new Error(`platform_fiscal_document_url_failed:${signed.error?.message ?? 'unknown'}`)
    return { contentHash: document.content_hash, signedUrl: signed.data.signedUrl }
  })
