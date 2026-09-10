import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { AccountOrderWorkspace, getAccount, type AccountView } from '@/features/account'
import { getMenu } from '@/features/menu'
import { PosTerminalPage } from '@/features/pos'
import { getServiceBoard } from '@/features/service'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'

export const Route = createFileRoute('/t/$slug/l/$venue/tpv')({
  validateSearch: z.object({ sessionId: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ sessionId: search.sessionId }),
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'operations'),
  loader: async ({ context, deps }) => {
    const { tenant, venue } = context
    const [board, menu] = await Promise.all([
      getServiceBoard({ data: { tenantId: tenant.id, venueId: venue.id } }),
      getMenu({ data: { tenantId: tenant.id } }),
    ])
    const sessionId =
      context.tenantMembership.role !== 'host' &&
      board.sessions.some((session) => session.id === deps.sessionId)
        ? deps.sessionId
        : undefined
    const account = sessionId
      ? await getAccount({ data: { sessionId, tenantId: tenant.id, venueId: venue.id } })
      : undefined
    return { account, board, menu }
  },
  component: PosTerminalRoute,
})

function PosTerminalRoute() {
  const { tenantMembership, venue } = Route.useRouteContext()
  const { account, board, menu } = Route.useLoaderData()
  return (
    <PosTerminalPage
      board={board}
      canAccessAccounts={tenantMembership.role !== 'host'}
      slug={Route.useParams().slug}
      venue={venue.slug}
    >
      {account && tenantMembership.role !== 'host' && <PosTerminalPageAccount account={account} />}
    </PosTerminalPage>
  )
}

function PosTerminalPageAccount({ account }: { account: AccountView }) {
  const { tenant, venue } = Route.useRouteContext()
  const { menu } = Route.useLoaderData()
  return (
    <>
      <span className="sr-only">{`Mesa ${account.session.tableCodes.join(' + ')}`}</span>
      <AccountOrderWorkspace
        account={account}
        locale={tenant.defaultLocale}
        menu={menu}
        tenantId={tenant.id}
        venueId={venue.id}
      />
    </>
  )
}
