import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { AccountView } from '@/features/account/application/account'
import { computeAccountTotals } from '@/features/account/domain/account'
import {
  loadAccount,
  type AccountQuery,
} from '@/features/account/infrastructure/server/account-repository'
import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { getCashRegister, listClosedCashRegisters } from '@/features/cash-register'
import { loadMenuCatalog, type MenuCatalog } from '@/features/menu/application/menu'
import { getSalesReport } from '@/features/reports'
import type { ServiceBoard } from '@/features/service'
import { loadServiceBoard } from '@/features/service/infrastructure/server/service-board-repository'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const posWorkspaceInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
})

export interface PosWorkspace {
  account: AccountView | undefined
  board: ServiceBoard
  menu: MenuCatalog
}

/**
 * Critical TPV read model. Authentication, membership and operational status
 * are checked once; the board and menu share the same RLS-bound client.
 */
export const getPosWorkspace = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(posWorkspaceInput)
  .handler(async ({ context, data }): Promise<PosWorkspace> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const now = new Date()
    const [board, menu] = await Promise.all([
      loadServiceBoard(supabase, { now, tenantId: data.tenantId, venueId: data.venueId }),
      loadMenuCatalog(supabase, data),
    ])
    const canAccessAccount = context.tenantMembership.role !== 'host'
    const sessionId =
      canAccessAccount &&
      data.sessionId &&
      board.sessions.some((session) => session.id === data.sessionId)
        ? data.sessionId
        : undefined
    if (!sessionId) return { account: undefined, board, menu }

    const accountData = await loadAccount(supabase, {
      sessionId,
      tenantId: data.tenantId,
      venueId: data.venueId,
    } satisfies AccountQuery)
    return {
      account: accountData
        ? {
            ...accountData,
            totals: computeAccountTotals(
              accountData.lines,
              accountData.payments,
              accountData.session.discountCents,
            ),
          }
        : undefined,
      board,
      menu,
    }
  })

export function posWorkspaceQuery(data: { tenantId: string; venueId: string; sessionId?: string }) {
  return queryOptions({
    queryFn: () => getPosWorkspace({ data }),
    queryKey: [
      'tenant',
      data.tenantId,
      'venue',
      data.venueId,
      'pos-workspace',
      data.sessionId ?? null,
    ],
    staleTime: 5_000,
  })
}

export function posManagementQuery(data: {
  tenantId: string
  venueId: string
  from: string
  to: string
}) {
  return queryOptions({
    queryFn: async () => {
      const venueData = { tenantId: data.tenantId, venueId: data.venueId }
      const [register, history, report] = await Promise.all([
        getCashRegister({ data: venueData }),
        listClosedCashRegisters({ data: venueData }),
        getSalesReport({ data: { ...venueData, from: data.from, to: data.to } }),
      ])
      return { history, register, report }
    },
    queryKey: [
      'tenant',
      data.tenantId,
      'venue',
      data.venueId,
      'pos-management',
      data.from,
      data.to,
    ],
    staleTime: 30_000,
  })
}
