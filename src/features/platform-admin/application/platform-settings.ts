import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'

import { createPlatformOwnerClient } from './platform-dashboard'

export const platformFiscalSettingsInput = z.object({
  addressLine: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(120),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  environment: z.enum(['test', 'prod']),
  issuanceEnabled: z.boolean(),
  issuerNif: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{9}$/),
  legalName: z.string().trim().min(1).max(200),
  postalCode: z.string().trim().min(1).max(20),
  seriesCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,12}$/),
})

export type PlatformFiscalSettings = z.infer<typeof platformFiscalSettingsInput>

/** Reads the fiscal identity used by SobreTaula to issue SaaS invoices. */
export const getPlatformFiscalSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PlatformFiscalSettings | null> => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { data, error } = await supabase
      .from('platform_fiscal_settings')
      .select(
        'address_line, city, country_code, environment, issuance_enabled, issuer_nif, legal_name, postal_code, series_code',
      )
      .maybeSingle()
    if (error) throw new Error(`platform_fiscal_settings_load_failed:${error.code}`)
    if (!data) return null
    return platformFiscalSettingsInput.parse({
      addressLine: data.address_line,
      city: data.city,
      countryCode: data.country_code,
      environment: data.environment,
      issuanceEnabled: data.issuance_enabled,
      issuerNif: data.issuer_nif,
      legalName: data.legal_name,
      postalCode: data.postal_code,
      seriesCode: data.series_code,
    })
  })

/** Updates platform fiscal identity. The owner-only RLS policy enforces access. */
export const savePlatformFiscalSettings = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(platformFiscalSettingsInput)
  .handler(async ({ context, data }) => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { error } = await supabase.from('platform_fiscal_settings').upsert(
      {
        address_line: data.addressLine,
        city: data.city,
        country_code: data.countryCode,
        environment: data.environment,
        id: true,
        issuance_enabled: data.issuanceEnabled,
        issuer_nif: data.issuerNif,
        legal_name: data.legalName,
        postal_code: data.postalCode,
        series_code: data.seriesCode,
      },
      { onConflict: 'id' },
    )
    if (error) throw new Error(`platform_fiscal_settings_save_failed:${error.code}`)
  })
