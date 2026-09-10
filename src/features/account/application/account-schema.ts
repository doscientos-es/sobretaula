import { z } from 'zod'

import { ORDER_ITEM_STATUSES, PAYMENT_METHODS } from '../domain/account'

export const accountSessionInput = z.object({
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
})

export const addOrderItemInput = accountSessionInput.extend({
  menuItemId: z.string().uuid(),
  modifierOptionIds: z.array(z.string().uuid()).max(50).default([]),
  notes: z.string().trim().max(200).optional(),
  operationId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99),
})

export const updateOrderItemInput = accountSessionInput.extend({
  notes: z.string().trim().max(200).nullable(),
  orderItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
})

export const removeOrderItemInput = accountSessionInput.extend({
  orderItemId: z.string().uuid(),
  reason: z.string().trim().min(2).max(200),
})

export const updateOrderItemStatusInput = accountSessionInput.extend({
  orderItemId: z.string().uuid(),
  status: z.enum(ORDER_ITEM_STATUSES),
})

export const recordPaymentInput = accountSessionInput.extend({
  amountCents: z.number().int().min(1).max(1_000_000),
  method: z.enum(PAYMENT_METHODS),
  tipCents: z.number().int().min(0).max(1_000_000).optional(),
})
export const recordMixedPaymentInput = accountSessionInput.extend({
  lines: z
    .array(
      z.object({
        amountCents: z.number().int().min(1).max(1_000_000),
        method: z.enum(PAYMENT_METHODS),
        tipCents: z.number().int().min(0).max(1_000_000).default(0),
      }),
    )
    .min(2)
    .max(6),
  operationId: z.string().uuid(),
})
export const refundPaymentInput = accountSessionInput.extend({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(1_000_000),
  reason: z.string().trim().min(2).max(200),
})
export const applyDiscountInput = accountSessionInput.extend({
  discountCents: z.number().int().min(1).max(1_000_000),
  reason: z.string().trim().min(2).max(200),
})

/** Apuntar y cobrar es trabajo de sala: camarero, encargado o dueño. */
export function requireAccountEditor(role: string): void {
  if (!['owner', 'manager', 'waiter'].includes(role))
    throw new Response('Forbidden', { status: 403 })
}
