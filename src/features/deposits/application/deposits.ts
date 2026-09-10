import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { validateDepositAmount } from '../domain/deposit-provider'

const input = z.object({
  tenantId: z.string().uuid(),
  reservationId: z.string().uuid(),
  amountCents: z.number().int().positive().max(10_000_000),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('EUR'),
  idempotencyKey: z.string().trim().min(8).max(120),
})
export const createReservationDeposit = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(input)
  .handler(async ({ context, data }) => {
    validateDepositAmount(data.amountCents)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: deposit, error } = await supabase
      .from('reservation_deposits')
      .upsert(
        {
          tenant_id: data.tenantId,
          reservation_id: data.reservationId,
          amount_cents: data.amountCents,
          currency: data.currency,
          idempotency_key: data.idempotencyKey,
        },
        { onConflict: 'tenant_id,idempotency_key' },
      )
      .select('id, amount_cents, currency, status')
      .single()
    if (error) throw new Error(`reservation_deposit_create_failed:${error.code}`)
    return deposit
  })
