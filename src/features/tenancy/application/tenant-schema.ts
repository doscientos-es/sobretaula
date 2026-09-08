import { z } from 'zod'

import { SUPPORTED_LOCALES } from '@/shared/lib/i18n/locale'

import { TENANT_STATUSES, type Tenant } from '../domain/tenant'

export const tenantRowSchema = z.object({
  default_locale: z.enum(SUPPORTED_LOCALES),
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(2),
  status: z.enum(TENANT_STATUSES),
  timezone: z.string().min(1),
})

export type TenantRow = z.infer<typeof tenantRowSchema>

export function toTenant(row: TenantRow): Tenant {
  return {
    defaultLocale: row.default_locale,
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    timezone: row.timezone,
  }
}
