import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { SUPPORTED_LOCALES } from '@/shared/lib/i18n/locale'

import { createPlatformOwnerClient } from './platform-dashboard'

const tenantIdInput = z.object({ tenantId: z.string().uuid() })
export const platformTenantConfigurationInput = tenantIdInput.extend({
  defaultLocale: z.enum(SUPPORTED_LOCALES),
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(64),
})

const platformTenantDetailRow = z.object({
  active_member_count: z.coerce.number().int().nonnegative(),
  active_venue_count: z.coerce.number().int().nonnegative(),
  certificate_configured: z.boolean(),
  certificate_expires_at: z.string().nullable(),
  closed_session_count_last_30_days: z.coerce.number().int().nonnegative(),
  created_at: z.string(),
  default_locale: z.enum(SUPPORTED_LOCALES),
  fiscal_issuer_nif: z.string().nullable(),
  fiscal_legal_name: z.string().nullable(),
  invoice_count: z.coerce.number().int().nonnegative(),
  invoice_series_count: z.coerce.number().int().nonnegative(),
  invoice_total_cents: z.coerce.number().int().nonnegative(),
  last_invoice_at: z.string().nullable(),
  outbox_error_count: z.coerce.number().int().nonnegative(),
  outbox_pending_count: z.coerce.number().int().nonnegative(),
  payment_total_cents_last_30_days: z.coerce.number().int().nonnegative(),
  registered_invoice_count: z.coerce.number().int().nonnegative(),
  reservation_count_last_30_days: z.coerce.number().int().nonnegative(),
  tenant_id: z.string().uuid(),
  tenant_name: z.string(),
  tenant_slug: z.string(),
  tenant_status: z.enum(['setup_pending', 'trial', 'active', 'suspended']),
  tenant_timezone: z.string(),
  verifactu_environment: z.enum(['test', 'prod']).nullable(),
  verifactu_ledger_count: z.coerce.number().int().nonnegative(),
})

export interface PlatformTenantDetail {
  activeMemberCount: number
  activeVenueCount: number
  certificateConfigured: boolean
  certificateExpiresAt: string | null
  closedSessionCountLast30Days: number
  createdAt: string
  defaultLocale: (typeof SUPPORTED_LOCALES)[number]
  fiscalIssuerNif: string | null
  fiscalLegalName: string | null
  invoiceCount: number
  invoiceSeriesCount: number
  invoiceTotalCents: number
  lastInvoiceAt: string | null
  outboxErrorCount: number
  outboxPendingCount: number
  paymentTotalCentsLast30Days: number
  registeredInvoiceCount: number
  reservationCountLast30Days: number
  tenantId: string
  tenantName: string
  tenantSlug: string
  tenantStatus: 'setup_pending' | 'trial' | 'active' | 'suspended'
  tenantTimezone: string
  verifactuEnvironment: 'test' | 'prod' | null
  verifactuLedgerCount: number
}

function toPlatformTenantDetail(
  row: z.infer<typeof platformTenantDetailRow>,
): PlatformTenantDetail {
  return {
    activeMemberCount: row.active_member_count,
    activeVenueCount: row.active_venue_count,
    certificateConfigured: row.certificate_configured,
    certificateExpiresAt: row.certificate_expires_at,
    closedSessionCountLast30Days: row.closed_session_count_last_30_days,
    createdAt: row.created_at,
    defaultLocale: row.default_locale,
    fiscalIssuerNif: row.fiscal_issuer_nif,
    fiscalLegalName: row.fiscal_legal_name,
    invoiceCount: row.invoice_count,
    invoiceSeriesCount: row.invoice_series_count,
    invoiceTotalCents: row.invoice_total_cents,
    lastInvoiceAt: row.last_invoice_at,
    outboxErrorCount: row.outbox_error_count,
    outboxPendingCount: row.outbox_pending_count,
    paymentTotalCentsLast30Days: row.payment_total_cents_last_30_days,
    registeredInvoiceCount: row.registered_invoice_count,
    reservationCountLast30Days: row.reservation_count_last_30_days,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
    tenantStatus: row.tenant_status,
    tenantTimezone: row.tenant_timezone,
    verifactuEnvironment: row.verifactu_environment,
    verifactuLedgerCount: row.verifactu_ledger_count,
  }
}

/** Returns the audited operational, fiscal and aggregate view of one platform tenant. */
export const getPlatformTenantDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(tenantIdInput)
  .handler(async ({ context, data }): Promise<PlatformTenantDetail> => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { data: rows, error } = await supabase.rpc('platform_tenant_overview', {
      p_tenant_id: data.tenantId,
    })
    if (error) throw new Error(`platform_tenant_detail_load_failed:${error.code}`)
    const row = rows?.[0]
    if (!row) throw new Response('Not found', { status: 404 })
    return toPlatformTenantDetail(platformTenantDetailRow.parse(row))
  })

/** Updates the non-fiscal tenant settings through an owner-only audited database function. */
export const updatePlatformTenantConfiguration = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(platformTenantConfigurationInput)
  .handler(async ({ context, data }) => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { error } = await supabase.rpc('update_platform_tenant_configuration', {
      p_default_locale: data.defaultLocale,
      p_name: data.name,
      p_tenant_id: data.tenantId,
      p_timezone: data.timezone,
    })
    if (error) throw new Error(`platform_tenant_configuration_save_failed:${error.code}`)
  })
