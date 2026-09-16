import { createFileRoute } from '@tanstack/react-router'

import { getPublicMenu, getPublicMenuContext, PublicMenuPage } from '@/features/menu'

export const Route = createFileRoute('/menu/$slug')({
  loader: async ({ params }) => {
    const [context, catalog] = await Promise.all([
      getPublicMenuContext({ data: { slug: params.slug } }),
      getPublicMenu({ data: { slug: params.slug, channel: 'web' } }),
    ])
    return { catalog, context }
  },
  component: PublicMenuRoute,
})

function PublicMenuRoute() {
  const { catalog, context } = Route.useLoaderData()
  return <PublicMenuPage catalog={catalog} locale={context.locale} />
}
