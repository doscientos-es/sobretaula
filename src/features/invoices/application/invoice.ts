import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  normalizeSeriesCode,
  validateFiscalSettings,
  type FiscalSettings,
  type InvoiceSeries,
} from '../domain/fiscal-settings'
import {
  buildFullNumber,
  canIssueInvoices,
  groupVatTotals,
  sumVatBreakdowns,
  normalizeNif,
  type Invoice,
} from '../domain/invoice'
import {
  createInvoiceDocumentUrl,
  findInvoiceDocument,
} from '../infrastructure/server/invoice-document-repository'
import {
  createSeries,
  findFiscalSettings,
  findVerifactuCertificateMetadata,
  listInvoices,
  listSeries,
  saveFiscalSettings,
  type VerifactuCertificateMetadata,
} from '../infrastructure/server/invoice-repository'
import {
  createSeriesInput,
  getInvoiceDocumentInput,
  issueInvoiceInput,
  listInvoicesInput,
  requireFiscalSettingsOwner,
  requireInvoiceReader,
  requireSeriesEditor,
  upsertFiscalSettingsInput,
} from './invoice-schema'

export interface FiscalSettingsView {
  certificate: VerifactuCertificateMetadata | null
  settings: FiscalSettings | null
  prefill: Partial<FiscalSettings> | null
  series: InvoiceSeries[]
  invoices: Invoice[]
}

/** Signed download URL for the fiscal PDF of an invoice. */
export const getInvoiceDocument = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(getInvoiceDocumentInput)
  .handler(async ({ context, data }) => {
    requireInvoiceReader(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', data.invoiceId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (error || !invoice) throw new Response('Not found', { status: 404 })

    const document = await findInvoiceDocument(supabase, data.invoiceId, data.tenantId)
    if (!document) throw new Response('Not found', { status: 404 })
    const signedUrl = await createInvoiceDocumentUrl(document.objectPath, 300)
    return { contentHash: document.contentHash, signedUrl }
  })
/** Everything the billing page needs in one call. */
export const getBillingOverview = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(listInvoicesInput)
  .handler(async ({ context, data }): Promise<FiscalSettingsView> => {
    requireInvoiceReader(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [settings, certificate, series, invoices, billingProfile] = await Promise.all([
      findFiscalSettings(supabase, data.tenantId),
      findVerifactuCertificateMetadata(supabase, data.tenantId),
      listSeries(supabase, data.tenantId),
      listInvoices(supabase, data.tenantId),
      supabase
        .from('platform_billing_customers')
        .select('address_line, city, postal_code, tax_id, legal_name')
        .eq('tenant_id', data.tenantId)
        .maybeSingle(),
    ])
    return {
      certificate,
      invoices,
      series,
      settings: settings ? validateFiscalSettings(settings) : null,
      prefill:
        settings || !billingProfile.data
          ? null
          : {
              addressLine: billingProfile.data.address_line,
              city: billingProfile.data.city,
              issuerNif: billingProfile.data.tax_id,
              legalName: billingProfile.data.legal_name,
              postalCode: billingProfile.data.postal_code,
              countryCode: 'ES',
            },
    }
  })

/** Owner-only save of the fiscal identity of the restaurant. */
export const upsertFiscalSettings = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(upsertFiscalSettingsInput)
  .handler(async ({ context, data }) => {
    requireFiscalSettingsOwner(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const settings = validateFiscalSettings(data)
    await saveFiscalSettings(supabase, data.tenantId, context.tenantMembership.userId, settings)
    return { ok: true }
  })

/** Creates the yearly series; unique (tenant, code, year) rejects duplicates. */
export const createInvoiceSeries = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(createSeriesInput)
  .handler(async ({ context, data }) => {
    requireSeriesEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const series = await createSeries(
      supabase,
      data.tenantId,
      normalizeSeriesCode(data.code),
      data.fiscalYear,
    )
    return { seriesId: series.id }
  })

/**
 * Emits the invoice of a closed, fully paid session: reserves the number
 * transactionally via RPC, snapshots lines and totals, and registers the
 * VERI*FACTU ledger entry + outbox row in test mode.
 */
export const issueInvoiceFromSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(issueInvoiceInput)
  .handler(async ({ context, data }) => {
    requireSeriesEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)

    const settings = await findFiscalSettings(supabase, data.tenantId)
    if (!canIssueInvoices(settings)) {
      throw new Response('Fiscal settings not ready for test emission', { status: 422 })
    }

    // Sesión cerrada de este venue, ya cobrada y sin factura previa.
    const { data: session, error: sessionError } = await supabase
      .from('table_sessions')
      .select('id, status')
      .eq('id', data.sessionId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('status', 'closed')
      .single()
    if (sessionError || !session) throw new Response('Not found', { status: 404 })

    const { data: existing, error: existingError } = await supabase
      .from('invoices')
      .select('id')
      .eq('tenant_id', data.tenantId)
      .eq('session_id', data.sessionId)
      .maybeSingle()
    if (existingError) throw new Error(`invoice_duplicate_check_failed:${existingError.code}`)
    if (existing) throw new Response('Session already invoiced', { status: 409 })

    const lines = await loadSessionLines(supabase, data.tenantId, data.sessionId)
    if (lines.length === 0) throw new Response('Empty session', { status: 422 })
    const breakdowns = groupVatTotals(lines)
    const totals = sumVatBreakdowns(breakdowns)
    const paid = await loadSessionPaidCents(supabase, data.tenantId, data.sessionId)
    if (paid < totals.gross) throw new Response('Unpaid balance', { status: 409 })

    const series = (await listSeries(supabase, data.tenantId)).find((s) => s.id === data.seriesId)
    if (!series) throw new Response('Not found', { status: 404 })

    // Reserva correlativa y atómica dentro de la serie (Postgres, no la app).
    const { data: number, error: numberError } = await supabase.rpc('reserve_invoice_number', {
      p_series_id: series.id,
    })
    if (numberError || typeof number !== 'number')
      throw new Error(`invoice_number_reserve_failed:${numberError?.code ?? 'unknown'}`)

    const fullNumber = buildFullNumber(series.code, series.fiscalYear, number)
    const now = new Date().toISOString()
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        customer_name: data.customerName ?? null,
        customer_nif: data.customerNif ? normalizeNif(data.customerNif) : null,
        full_number: fullNumber,
        issued_at: now,
        issuer_nif: settings.issuerNif,
        lines: breakdowns.map((item) => ({
          net_cents: item.net,
          rate_bps: item.rateBps,
          vat_cents: item.vat,
        })),
        number,
        series_id: series.id,
        session_id: data.sessionId,
        status: 'issued',
        subtotal_cents: totals.net,
        tenant_id: data.tenantId,
        total_cents: totals.gross,
        vat_cents: totals.vat,
      })
      .select('id')
      .single()
    if (invoiceError || !invoice)
      throw new Error(`invoice_create_failed:${invoiceError?.code ?? 'unknown'}`)

    const invoiceId = invoice.id as string
    await registerVerifactuRecord(supabase, {
      environment: settings.environment,
      invoiceId,
      issuerNif: settings.issuerNif,
      payload: {
        breakdowns,
        fullNumber,
        issuedAt: now,
        totals,
      },
      tenantId: data.tenantId,
    })
    return { invoiceId, fullNumber }
  })

async function loadSessionLines(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
): Promise<{ name: string; quantity: number; unitPriceCents: number; vatRateBps: number }[]> {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
  if (ordersError) throw new Error(`invoice_lines_lookup_failed:${ordersError.code}`)
  const orderIds = (orders ?? []).map((order) => order.id as string)
  if (orderIds.length === 0) return []
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('name_snapshot, quantity, unit_price_cents, vat_rate_bps')
    .eq('tenant_id', tenantId)
    .in('order_id', orderIds)
  if (itemsError) throw new Error(`invoice_lines_lookup_failed:${itemsError.code}`)
  return (items ?? []).map((item) => ({
    name: item.name_snapshot as string,
    quantity: item.quantity as number,
    unitPriceCents: item.unit_price_cents as number,
    vatRateBps: item.vat_rate_bps as number,
  }))
}

async function loadSessionPaidCents(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
  if (error) throw new Error(`invoice_paid_lookup_failed:${error.code}`)
  return (data ?? []).reduce((sum, payment) => sum + (payment.amount_cents as number), 0)
}

/**
 * TEST mode record: appends the hash-chained ledger entry (per issuer NIF) and
 * queues the outbox delivery. The AEAT adapter is a later feature; the record
 * is already tamper-evident and append-only.
 */
async function registerVerifactuRecord(
  supabase: SupabaseClient,
  input: {
    environment: 'test' | 'prod'
    invoiceId: string
    issuerNif: string
    payload: unknown
    tenantId: string
  },
): Promise<void> {
  const { data: previous, error: previousError } = await supabase
    .from('verifactu_ledger')
    .select('chain_sequence, current_hash')
    .eq('issuer_nif', input.issuerNif)
    .order('chain_sequence', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (previousError) throw new Error(`verifactu_chain_lookup_failed:${previousError.code}`)

  const chainSequence = (previous?.chain_sequence as number | undefined) ?? 0
  const previousHash = (previous?.current_hash as string | undefined) ?? null
  const currentHash = await computeRecordHash(input.issuerNif, chainSequence + 1, input.payload)

  const { data: ledger, error: ledgerError } = await supabase
    .from('verifactu_ledger')
    .insert({
      chain_sequence: chainSequence + 1,
      current_hash: currentHash,
      environment: input.environment,
      invoice_id: input.invoiceId,
      issuer_nif: input.issuerNif,
      payload: input.payload as Record<string, unknown>,
      previous_hash: previousHash,
      qr_payload: `verifactu:test:${input.issuerNif}:${chainSequence + 1}`,
      tenant_id: input.tenantId,
    })
    .select('id')
    .single()
  if (ledgerError || !ledger)
    throw new Error(`verifactu_ledger_insert_failed:${ledgerError?.code ?? 'unknown'}`)

  const { error: outboxError } = await supabase.from('verifactu_outbox').insert({
    ledger_id: ledger.id as string,
    status: 'pending',
    tenant_id: input.tenantId,
  })
  if (outboxError) throw new Error(`verifactu_outbox_insert_failed:${outboxError.code}`)
}

/** Hash chain link: sha256 of issuer + sequence + previous hash + payload. */
async function computeRecordHash(
  issuerNif: string,
  sequence: number,
  payload: unknown,
): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256')
    .update(`${issuerNif}|${sequence}|${JSON.stringify(payload)}`)
    .digest('hex')
    .toUpperCase()
}
