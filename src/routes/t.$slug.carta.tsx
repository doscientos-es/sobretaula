import { createFileRoute, notFound } from '@tanstack/react-router'

import { getPublicMenu, PublicMenuPage } from '@/features/menu'
import { tenantBySlugQuery } from '@/features/tenancy'

export const Route = createFileRoute('/t/$slug/carta')({
  loader: async ({ context, params }) => {
    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(params.slug))
    if (!tenant) throw notFound()
    const catalog = await getPublicMenu({ data: { slug: params.slug } })
    return { catalog, tenant }
  },
  component: MenuRoute,
})

function MenuRoute() {
  const { catalog, tenant } = Route.useLoaderData()

  return <PublicMenuPage catalog={catalog} locale={tenant.defaultLocale} />
}
