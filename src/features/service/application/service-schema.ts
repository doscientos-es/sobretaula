import { z } from 'zod'

const tableIds = z.array(z.string().uuid()).min(1).max(6)

export const serviceVenueInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
})

export const operationId = z.string().uuid().optional()

export const seatWalkInInput = serviceVenueInput.extend({
  covers: z.number().int().min(1).max(50),
  guestName: z.string().trim().min(1).max(200).optional(),
  operationId,
  tableIds,
})

export const moveSessionInput = serviceVenueInput.extend({
  operationId,
  sessionId: z.string().uuid(),
  tableIds,
})

export const mergeSessionsInput = serviceVenueInput
  .extend({
    operationId,
    sourceSessionId: z.string().uuid(),
    targetSessionId: z.string().uuid(),
  })
  .refine((input) => input.sourceSessionId !== input.targetSessionId, {
    message: 'cannot_merge_a_session_with_itself',
    path: ['sourceSessionId'],
  })

export const closeSessionInput = serviceVenueInput.extend({
  operationId,
  sessionId: z.string().uuid(),
})

export const updateSessionNoteInput = serviceVenueInput.extend({
  internalNote: z.string().trim().max(500).nullable(),
  sessionId: z.string().uuid(),
})

export const noShowReservationInput = serviceVenueInput.extend({
  reason: z.string().trim().max(500).optional(),
  reservationId: z.string().uuid(),
})

export const waitlistEntryInput = serviceVenueInput.extend({
  estimatedWaitMinutes: z.number().int().min(0).max(480).nullable(),
  guestName: z.string().trim().min(1).max(200).optional(),
  guestPhone: z.string().trim().min(3).max(40).optional(),
  partySize: z.number().int().min(1).max(50),
})

export const waitlistEntryReference = serviceVenueInput.extend({
  waitlistEntryId: z.string().uuid(),
})

export const seatWaitlistEntryInput = waitlistEntryReference.extend({
  operationId,
  tableIds,
})

/** Sala del día: quien mueve mesas y abre cuentas. */
export function requireServiceEditor(role: string): void {
  if (!['owner', 'manager', 'host', 'waiter'].includes(role))
    throw new Response('Forbidden', { status: 403 })
}

/** La lista de espera es del jefe de sala; RLS no la abre al camarero. */
export function requireWaitlistEditor(role: string): void {
  if (!['owner', 'manager', 'host'].includes(role)) throw new Response('Forbidden', { status: 403 })
}
