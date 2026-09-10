import { z } from 'zod'

import { SUPPORTED_LOCALES } from '@/shared/lib/i18n/locale'

export const tenantOnboardingInput = z.object({
  addressLine: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  defaultLocale: z.enum(SUPPORTED_LOCALES),
  email: z.string().trim().email().max(254),
  legalName: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(20),
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/),
  taxId: z.string().trim().min(1).max(32),
  timezone: z.string().trim().min(1).max(64),
})

export type TenantOnboardingInput = z.infer<typeof tenantOnboardingInput>

/** Produces a valid starting point, while server validation remains authoritative. */
export function tenantSlugCandidate(name: string): string {
  const candidate = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return candidate.length >= 3 ? candidate : `restaurante-${candidate || 'nuevo'}`
}
