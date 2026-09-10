import { createOfflineOperation, type OfflineOperation } from '@/shared/lib/offline-operation-queue'
import { flushOfflineOperations } from '@/shared/lib/offline-operation-runner'
import { createLocalStorageOperationStore } from '@/shared/lib/offline-operation-store'

import { seatReservation } from './table-service'

export interface SeatReservationOperation {
  kind: 'seat-reservation'
  operationId: string
  reservationId: string
  tenantId: string
  venueId: string
}

type ServiceOfflineOperation = SeatReservationOperation

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
    if (operation.payload.kind !== 'seat-reservation') return true
    try {
      await seatReservation({ data: operation.payload })
      return true
    } catch {
      return false
    }
  })
}
