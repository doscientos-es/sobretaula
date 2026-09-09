import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { ServiceBoard } from '../domain/service-board'
import { loadServiceBoard } from '../infrastructure/server/service-board-repository'
import { serviceVenueInput } from './service-schema'

/** Live picture of the room: tables, open sessions, next bookings and waitlist. */
export const getServiceBoard = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(serviceVenueInput)
  .handler(async ({ context, data }): Promise<ServiceBoard> =>
    loadServiceBoard(createRequestSupabaseClient(context.tenantMembership.accessToken), {
      now: new Date(),
      tenantId: data.tenantId,
      venueId: data.venueId,
    }),
  )
