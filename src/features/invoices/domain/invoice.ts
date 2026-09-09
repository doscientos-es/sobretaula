import { assertMinorUnits, type MinorUnits } from '@/shared/lib/money/money'

export const INVOICE_STATUSES = ['draft', 'issued', 'registered', 'rejected', 'voided'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const VERIFACTU_ENVS = ['test', 'prod'] as const
export type VerifactuEnv = (typeof VERIFACTU_ENVS)[number]

export interface Invoice {
  id: string
  tenantId: string
  series: string
  number: number
  fullNumber: string
  issuedAt: string
  issuerNif: string
  customerName: string | null
  status: InvoiceStatus
  totalNet: MinorUnits
  totalTax: MinorUnits
  totalGross: MinorUnits
  verifactuEnv: VerifactuEnv
}

/** An issued invoice is immutable: correcting it means issuing a new document. */
export function isInvoiceMutable(status: InvoiceStatus): boolean {
  return status === 'draft'
}

export function formatInvoiceReference(series: string, number: number): string {
  return `${series}/${number.toString().padStart(6, '0')}`
}

/** NIF format shared with the database constraint: 9 alphanumeric characters. */
const NIF_PATTERN = /^[A-Z0-9]{9}$/

/** Canonical form: trimmed, upper-cased, without inner spaces or dashes. */
export function normalizeNif(rawNif: string): string {
  return rawNif.trim().toUpperCase().replaceAll(' ', '').replaceAll('-', '')
}

export function isValidNifFormat(rawNif: string): boolean {
  return NIF_PATTERN.test(normalizeNif(rawNif))
}

/** Fiscal year a series counter belongs to; series reset every January. */
export function currentFiscalYear(now: Date): number {
  return now.getUTCFullYear()
}

/** Human reference "PREFIX-YYYY/000042" shown on the document. */
export function buildFullNumber(seriesCode: string, fiscalYear: number, number: number): string {
  return `${seriesCode}-${fiscalYear}/${number.toString().padStart(6, '0')}`
}

export interface VatBreakdown {
  net: MinorUnits
  rateBps: number
  vat: MinorUnits
}

export interface VatTotalsLine {
  quantity: number
  unitPriceCents: MinorUnits
  vatRateBps: number
}

/**
 * Fiscal totals grouped by VAT rate from VAT-included lines. The net of each
 * line rounds like the account does, so both views always agree.
 */
export function groupVatTotals(lines: readonly VatTotalsLine[]): VatBreakdown[] {
  const byRate = new Map<number, VatBreakdown>()
  for (const line of lines) {
    const gross = assertMinorUnits(line.quantity * line.unitPriceCents)
    const net = assertMinorUnits(Math.round((gross * 10_000) / (10_000 + line.vatRateBps)))
    const current = byRate.get(line.vatRateBps) ?? { net: 0, rateBps: line.vatRateBps, vat: 0 }
    current.net += net
    current.vat += gross - net
    byRate.set(line.vatRateBps, current)
  }
  return [...byRate.values()].sort((a, b) => b.rateBps - a.rateBps)
}

export function sumVatBreakdowns(breakdowns: readonly VatBreakdown[]): {
  net: MinorUnits
  vat: MinorUnits
  gross: MinorUnits
} {
  const net = breakdowns.reduce((sum, item) => sum + item.net, 0)
  const vat = breakdowns.reduce((sum, item) => sum + item.vat, 0)
  return { gross: net + vat, net, vat }
}

/**
 * Whether this tenant may emit invoices now. The MVP only issues in `test`:
 * `prod` requires the fiscal checklist and the AEAT adapter (ADR-0005).
 */
export function invoiceIssueBlocker(
  settings: { environment: VerifactuEnv } | null,
): 'fiscal_settings_missing' | 'prod_not_enabled' | null {
  if (!settings) return 'fiscal_settings_missing'
  if (settings.environment === 'prod') return 'prod_not_enabled'
  return null
}
