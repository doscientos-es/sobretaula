import { createFileRoute } from '@tanstack/react-router'

import { getPublicMenu, getPublicMenuContext, PublicMenuPage } from '@/features/menu'

export const Route = createFileRoute('/menu/$slug')({
  loader: async ({ params }) => {
    const context = await getPublicMenuContext({ data: { slug: params.slug } })
    const catalog = await getPublicMenu({ data: { slug: params.slug, channel: 'web' } })
    return { catalog, context }
  },
  component: PublicMenuRoute,
})

function PublicMenuRoute() {
  const { catalog, context } = Route.useLoaderData()
  return (
    <PublicMenuPage
      catalog={catalog}
      locale={context.locale}
      tenantId={context.tenantId}
      venueId={context.venueId}
    />
  )
}
