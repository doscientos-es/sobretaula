import { createOfflineOperation, type OfflineOperation } from '@/shared/lib/offline-operation-queue'
import { flushOfflineOperations } from '@/shared/lib/offline-operation-runner'
import { createLocalStorageOperationStore } from '@/shared/lib/offline-operation-store'

import {
  cancelReservation,
  closeSession,
  markReservationNoShow,
  mergeSessions,
  moveSession,
  seatReservation,
  seatWalkIn,
} from './table-service'
import { addToWaitlist, removeFromWaitlist, seatWaitlistEntry } from './waitlist'

export interface SeatReservationOperation {
  kind: 'seat-reservation'
  operationId: string
  reservationId: string
  tenantId: string
  venueId: string
}

export interface SeatWalkInOperation {
  kind: 'seat-walk-in'
  operationId: string
  covers: number
  tableIds: string[]
  tenantId: string
  venueId: string
}

export interface SeatWaitlistOperation {
  kind: 'seat-waitlist'
  operationId: string
  tableIds: string[]
  tenantId: string
  venueId: string
  waitlistEntryId: string
}
export interface AddWaitlistOperation {
  kind: 'add-waitlist'
  operationId: string
  estimatedWaitMinutes: number | null
  expiresAt?: string
  guestName?: string
  guestPhone?: string
  partySize: number
  preferredAreaId?: string
  requestedFor?: string
  serviceId?: string
  tenantId: string
  venueId: string
}

export interface MoveSessionOperation {
  kind: 'move-session'
  operationId: string
  sessionId: string
  tableIds: string[]
  tenantId: string
  venueId: string
}

export interface MergeSessionsOperation {
  kind: 'merge-sessions'
  operationId: string
  sourceSessionId: string
  targetSessionId: string
  tenantId: string
  venueId: string
}

export interface CloseSessionOperation {
  kind: 'close-session'
  operationId: string
  sessionId: string
  tenantId: string
  venueId: string
}
export interface ReservationTransitionOperation {
  kind: 'cancel-reservation' | 'no-show-reservation'
  operationId: string
  reservationId: string
  tenantId: string
  venueId: string
}
export interface RemoveWaitlistOperation {
  kind: 'remove-waitlist'
  operationId: string
  waitlistEntryId: string
  tenantId: string
  venueId: string
}

type ServiceOfflineOperation =
  | SeatReservationOperation
  | SeatWalkInOperation
  | SeatWaitlistOperation
  | AddWaitlistOperation
  | MoveSessionOperation
  | MergeSessionsOperation
  | CloseSessionOperation
  | ReservationTransitionOperation
  | RemoveWaitlistOperation

function createId(): string {
  return crypto.randomUUID()
}

export function createSeatReservationOperation(
  input: Omit<SeatReservationOperation, 'kind' | 'operationId'>,
) {
  const operationId = createId()
  return createOfflineOperation<ServiceOfflineOperation>('seat-reservation:' + operationId, {
    kind: 'seat-reservation',
    operationId,
    ...input,
  })
}

export function createSeatWalkInOperation(
  input: Omit<SeatWalkInOperation, 'kind' | 'operationId'>,
) {
  const operationId = createId()
  return createOfflineOperation<ServiceOfflineOperation>('seat-walk-in:' + operationId, {
    kind: 'seat-walk-in',
    operationId,
    ...input,
  })
}

export function createSeatWaitlistOperation(
  input: Omit<SeatWaitlistOperation, 'kind' | 'operationId'>,
) {
  const operationId = createId()
  return createOfflineOperation<ServiceOfflineOperation>('seat-waitlist:' + operationId, {
    kind: 'seat-waitlist',
    operationId,
    ...input,
  })
}

export const createAddWaitlistOperation = (
  input: Omit<AddWaitlistOperation, 'kind' | 'operationId'>,
) => createOperation<AddWaitlistOperation>('add-waitlist', input)

function createOperation<T extends ServiceOfflineOperation>(
  kind: T['kind'],
  input: Omit<T, 'kind' | 'operationId'>,
) {
  const operationId = createId()
  return createOfflineOperation<ServiceOfflineOperation>(`${kind}:${operationId}`, {
    kind,
    operationId,
    ...input,
  } as T)
}

export const createMoveSessionOperation = (
  input: Omit<MoveSessionOperation, 'kind' | 'operationId'>,
) => createOperation<MoveSessionOperation>('move-session', input)

export const createMergeSessionsOperation = (
  input: Omit<MergeSessionsOperation, 'kind' | 'operationId'>,
) => createOperation<MergeSessionsOperation>('merge-sessions', input)

export const createCloseSessionOperation = (
  input: Omit<CloseSessionOperation, 'kind' | 'operationId'>,
) => createOperation<CloseSessionOperation>('close-session', input)
export const createCancelReservationOperation = (
  input: Omit<ReservationTransitionOperation, 'kind' | 'operationId'>,
) => createOperation<ReservationTransitionOperation>('cancel-reservation', input)
export const createNoShowReservationOperation = (
  input: Omit<ReservationTransitionOperation, 'kind' | 'operationId'>,
) => createOperation<ReservationTransitionOperation>('no-show-reservation', input)
export const createRemoveWaitlistOperation = (
  input: Omit<RemoveWaitlistOperation, 'kind' | 'operationId'>,
) => createOperation<RemoveWaitlistOperation>('remove-waitlist', input)

export function createServiceOfflineStore(tenantId: string, venueId: string) {
  return createLocalStorageOperationStore<ServiceOfflineOperation>(
    `sobretaula:service-offline:${tenantId}:${venueId}`,
  )
}

export function enqueueServiceOperation(
  store: ReturnType<typeof createServiceOfflineStore>,
  operation: OfflineOperation<ServiceOfflineOperation>,
): void {
  const operations = store.read().filter((current) => current.id !== operation.id)
  store.write([...operations, operation])
}

export async function flushServiceOperations(
  store: ReturnType<typeof createServiceOfflineStore>,
): Promise<{ completed: number; retried: number }> {
  return flushOfflineOperations(store, async (operation) => {
    try {
      if (operation.payload.kind === 'seat-reservation')
        await seatReservation({ data: operation.payload })
      else if (operation.payload.kind === 'seat-walk-in')
        await seatWalkIn({ data: operation.payload })
      else if (operation.payload.kind === 'seat-waitlist')
        await seatWaitlistEntry({ data: operation.payload })
      else if (operation.payload.kind === 'add-waitlist')
        await addToWaitlist({ data: operation.payload })
      else if (operation.payload.kind === 'move-session')
        await moveSession({ data: operation.payload })
      else if (operation.payload.kind === 'merge-sessions')
        await mergeSessions({ data: operation.payload })
      else if (operation.payload.kind === 'cancel-reservation')
        await cancelReservation({ data: operation.payload })
      else if (operation.payload.kind === 'no-show-reservation')
        await markReservationNoShow({ data: operation.payload })
      else if (operation.payload.kind === 'remove-waitlist')
        await removeFromWaitlist({ data: operation.payload })
      else if (operation.payload.kind === 'close-session')
        await closeSession({ data: operation.payload })
      return true
    } catch {
      return false
    }
  })
}
