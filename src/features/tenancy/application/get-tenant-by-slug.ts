import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { findTenantBySlug } from '../infrastructure/server/tenant-repository'

const slugInput = z.object({ slug: z.string().min(2).max(50) })

export const getTenantBySlug = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }) => findTenantBySlug(data.slug))

export function tenantBySlugQuery(slug: string) {
  return queryOptions({
    queryFn: () => getTenantBySlug({ data: { slug } }),
    queryKey: ['tenant', slug],
    staleTime: 5 * 60_000,
  })
}
