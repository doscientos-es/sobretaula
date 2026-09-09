import type { SupabaseClient } from '@supabase/supabase-js'

import type { InvoiceSeries, FiscalSettings } from '../../domain/fiscal-settings'
import type { Invoice } from '../../domain/invoice'

export interface IssuableSessionData {
  sessionId: string
  lines: { name: string; quantity: number; unitPriceCents: number; vatRateBps: number }[]
  netCents: number
  vatCents: number
  grossCents: number
}

/** Loads the tenant's fiscal settings; null when the tenant has none yet. */
export async function findFiscalSettings(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<FiscalSettings | null> {
  const { data, error } = await supabase
    .from('tenant_fiscal_settings')
    .select('address_line, city, country_code, environment, issuer_nif, legal_name, postal_code')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw new Error(`fiscal_settings_lookup_failed:${error.code}`)
  if (!data) return null
  return {
    addressLine: data.address_line as string,
    city: data.city as string,
    countryCode: data.country_code as string,
    environment: data.environment as FiscalSettings['environment'],
    issuerNif: data.issuer_nif as string,
    legalName: data.legal_name as string,
    postalCode: data.postal_code as string,
  }
}

/** Upserts fiscal settings and leaves an append-only audit entry. */
export async function saveFiscalSettings(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  settings: FiscalSettings,
): Promise<void> {
  const { error } = await supabase.from('tenant_fiscal_settings').upsert(
    {
      address_line: settings.addressLine,
      city: settings.city,
      country_code: settings.countryCode,
      environment: settings.environment,
      issuer_nif: settings.issuerNif,
      legal_name: settings.legalName,
      postal_code: settings.postalCode,
      tenant_id: tenantId,
    },
    { onConflict: 'tenant_id' },
  )
  if (error) throw new Error(`fiscal_settings_save_failed:${error.code}`)

  const { data: existing } = await supabase
    .from('tenant_fiscal_settings')
    .select('environment')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const { error: auditError } = await supabase.from('fiscal_settings_audit').insert({
    actor_id: userId,
    detail: { environment: settings.environment },
    tenant_id: tenantId,
    action: existing ? 'environment_changed' : 'created',
  })
  if (auditError) throw new Error(`fiscal_settings_audit_failed:${auditError.code}`)
}

export async function listSeries(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<InvoiceSeries[]> {
  const { data, error } = await supabase
    .from('invoice_series')
    .select('code, fiscal_year, id, next_number')
    .eq('tenant_id', tenantId)
    .order('fiscal_year')
    .order('code')
  if (error) throw new Error(`invoice_series_lookup_failed:${error.code}`)
  return (data ?? []).map((row) => ({
    code: row.code as string,
    fiscalYear: row.fiscal_year as number,
    id: row.id as string,
    nextNumber: row.next_number as number,
  }))
}

export async function createSeries(
  supabase: SupabaseClient,
  tenantId: string,
  code: string,
  fiscalYear: number,
): Promise<InvoiceSeries> {
  const { data, error } = await supabase
    .from('invoice_series')
    .insert({ code, fiscal_year: fiscalYear, next_number: 1, tenant_id: tenantId })
    .select('code, fiscal_year, id, next_number')
    .single()
  if (error) throw new Error(`invoice_series_create_failed:${error.code}`)
  return {
    code: data.code as string,
    fiscalYear: data.fiscal_year as number,
    id: data.id as string,
    nextNumber: data.next_number as number,
  }
}

export async function listInvoices(supabase: SupabaseClient, tenantId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'customer_name, full_number, id, issued_at, issuer_nif, number, series_id, status, subtotal_cents, total_cents, vat_cents',
    )
    .eq('tenant_id', tenantId)
    .order('issued_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`invoices_lookup_failed:${error.code}`)
  return (data ?? []).map((row) => ({
    customerName: (row.customer_name as string | null) ?? null,
    fullNumber: row.full_number as string,
    id: row.id as string,
    issuedAt: row.issued_at as string,
    issuerNif: row.issuer_nif as string,
    number: row.number as number,
    series: row.series_id as string,
    status: row.status as Invoice['status'],
    tenantId,
    totalGross: row.total_cents as number,
    totalNet: row.subtotal_cents as number,
    totalTax: row.vat_cents as number,
    verifactuEnv: 'test',
  }))
}
