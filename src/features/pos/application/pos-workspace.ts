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
      loadServiceBoard(supabase, {
        now,
        tenantId: data.tenantId,
        venueId: data.venueId,
      }),
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

/** Fast first-paint read for the terminal when no account is selected. */
export const getPosBoard = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(posWorkspaceInput)
  .handler(async ({ context, data }): Promise<ServiceBoard> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    return loadServiceBoard(supabase, {
      now: new Date(),
      tenantId: data.tenantId,
      venueId: data.venueId,
    })
  })

export const getPosAccount = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(posWorkspaceInput.extend({ sessionId: z.string().uuid() }))
  .handler(async ({ context, data }): Promise<AccountView | undefined> => {
    if (context.tenantMembership.role === 'host') return undefined
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const accountData = await loadAccount(supabase, data satisfies AccountQuery)
    return accountData
      ? {
          ...accountData,
          totals: computeAccountTotals(
            accountData.lines,
            accountData.payments,
            accountData.session.discountCents,
          ),
        }
      : undefined
  })

export const getPosMenu = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(posWorkspaceInput)
  .handler(async ({ context, data }): Promise<MenuCatalog> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    return loadMenuCatalog(supabase, data)
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
    // The service board is refreshed by explicit mutations/reloads. Avoid a
    // duplicate full workspace request every time the tablet regains focus.
    refetchOnWindowFocus: false,
  })
}

export function posBoardQuery(data: { tenantId: string; venueId: string }) {
  return queryOptions({
    queryFn: () => getPosBoard({ data }),
    queryKey: ['tenant', data.tenantId, 'venue', data.venueId, 'pos-board'],
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })
}

export function posAccountQuery(data: { tenantId: string; venueId: string; sessionId: string }) {
  return queryOptions({
    queryFn: () => getPosAccount({ data }),
    queryKey: ['tenant', data.tenantId, 'venue', data.venueId, 'pos-account', data.sessionId],
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })
}

export function posMenuQuery(data: { tenantId: string; venueId: string }) {
  return queryOptions({
    queryFn: () => getPosMenu({ data }),
    queryKey: ['tenant', data.tenantId, 'venue', data.venueId, 'pos-menu'],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
        getSalesReport({
          data: { ...venueData, from: data.from, to: data.to },
        }),
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
