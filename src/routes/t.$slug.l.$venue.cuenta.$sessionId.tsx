import { createFileRoute } from '@tanstack/react-router'

import { AccountPage, getAccount } from '@/features/account'
import { getMenu } from '@/features/menu'

export const Route = createFileRoute('/t/$slug/l/$venue/cuenta/$sessionId')({
  loader: async ({ context, params }) => {
    const data = {
      sessionId: params.sessionId,
      tenantId: context.tenant.id,
      venueId: context.venue.id,
    }
    const [account, menu] = await Promise.all([
      getAccount({ data }),
      getMenu({ data: { tenantId: context.tenant.id } }),
    ])

    return { account, menu }
  },
  component: AccountRoute,
})

function AccountRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const { account, menu } = Route.useLoaderData()

  return (
    <AccountPage
      account={account}
      locale={tenant.defaultLocale}
      menu={menu}
      tenantId={tenant.id}
      venueId={venue.id}
    />
  )
}
