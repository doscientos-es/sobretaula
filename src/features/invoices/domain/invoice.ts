import type { MinorUnits } from '@/shared/lib/money/money'

export const INVOICE_STATUSES = ['draft', 'issued', 'registered', 'rejected', 'voided'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const VERIFACTU_ENVS = ['test', 'prod'] as const
export type VerifactuEnv = (typeof VERIFACTU_ENVS)[number]

export interface Invoice {
  id: string
  tenantId: string
  series: string
  number: number
  issuedAt: string
  issuerNif: string
  totalNet: MinorUnits
  totalTax: MinorUnits
  totalGross: MinorUnits
  status: InvoiceStatus
  verifactuEnv: VerifactuEnv
}

/** An issued invoice is immutable: correcting it means issuing a new document. */
export function isInvoiceMutable(status: InvoiceStatus): boolean {
  return status === 'draft'
}

export function formatInvoiceReference(series: string, number: number): string {
  return `${series}/${number.toString().padStart(6, '0')}`
}
