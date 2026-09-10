import { createOfflineOperation, type OfflineOperation } from '@/shared/lib/offline-operation-queue'
import { flushOfflineOperations } from '@/shared/lib/offline-operation-runner'
import { createLocalStorageOperationStore } from '@/shared/lib/offline-operation-store'

import { seatReservation, seatWalkIn } from './table-service'
import { seatWaitlistEntry } from './waitlist'

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

type ServiceOfflineOperation =
  | SeatReservationOperation
  | SeatWalkInOperation
  | SeatWaitlistOperation

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
      else await seatWaitlistEntry({ data: operation.payload })
      return true
    } catch {
      return false
    }
  })
}
