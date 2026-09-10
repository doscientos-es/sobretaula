import { z } from 'zod'

/** Fiscal settings editable by the tenant owner (ADR-0005: no certificate here). */
export const upsertFiscalSettingsInput = z.object({
  addressLine: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(80),
  countryCode: z.string().trim().length(2),
  issuerNif: z.string().trim().min(9).max(12),
  legalName: z.string().trim().min(1).max(120),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/),
  tenantId: z.string().uuid(),
})

export const createSeriesInput = z.object({
  code: z.string().trim().min(1).max(12),
  fiscalYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
})

export const listInvoicesInput = z.object({
  tenantId: z.string().uuid(),
})

export const getInvoiceDocumentInput = z.object({
  invoiceId: z.string().uuid(),
  tenantId: z.string().uuid(),
})

/** Emitting an invoice from a settled session is owner/manager/accountant work. */
export const issueInvoiceInput = z.object({
  customerName: z.string().trim().min(1).max(120).optional(),
  customerNif: z.string().trim().min(9).max(12).optional(),
  seriesId: z.string().uuid(),
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
})

/** Only owners manage fiscal settings; series accept owner and manager. */
export function requireFiscalSettingsOwner(role: string): void {
  if (role !== 'owner') throw new Response('Forbidden', { status: 403 })
}

export function requireSeriesEditor(role: string): void {
  if (!['owner', 'manager'].includes(role)) throw new Response('Forbidden', { status: 403 })
}

/** Reading the invoice book is allowed to the same profiles the RLS policy grants. */
export function requireInvoiceReader(role: string): void {
  if (!['owner', 'manager', 'accountant', 'waiter'].includes(role))
    throw new Response('Forbidden', { status: 403 })
}
