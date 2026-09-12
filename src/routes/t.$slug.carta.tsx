import { createFileRoute, notFound } from '@tanstack/react-router'

import { getPublicMenu, PublicMenuPage } from '@/features/menu'
import { tenantBySlugQuery } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

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
  const locale = useLocale(tenant.defaultLocale)

  return <PublicMenuPage catalog={catalog} locale={locale} />
}
