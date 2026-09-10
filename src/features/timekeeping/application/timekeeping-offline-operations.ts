import { createOfflineOperation, type OfflineOperation } from '@/shared/lib/offline-operation-queue'
import { flushOfflineOperations } from '@/shared/lib/offline-operation-runner'
import { createLocalStorageOperationStore } from '@/shared/lib/offline-operation-store'

import type { TimeEventType } from '../domain/timekeeping'
import { recordOfflineTimeEvent } from './timekeeping'

export interface TimekeepingOfflineOperation {
  clientOccurredAt: string
  employeeId: string
  eventType: TimeEventType
  kind: 'timekeeping-event'
  operationId: string
  tenantId: string
  venueId: string
}

export function createTimekeepingOfflineOperation(
  input: Omit<TimekeepingOfflineOperation, 'kind'>,
): OfflineOperation<TimekeepingOfflineOperation> {
  return createOfflineOperation(`timekeeping-event:${input.operationId}`, {
    kind: 'timekeeping-event',
    ...input,
  })
}

export function createTimekeepingOfflineStore(tenantId: string, venueId: string) {
  return createLocalStorageOperationStore<TimekeepingOfflineOperation>(
    `sobretaula:timekeeping-offline:${tenantId}:${venueId}`,
  )
}

export function enqueueTimekeepingOperation(
  store: ReturnType<typeof createTimekeepingOfflineStore>,
  operation: OfflineOperation<TimekeepingOfflineOperation>,
): void {
  store.write([...store.read().filter((current) => current.id !== operation.id), operation])
}

export function flushTimekeepingOperations(
  store: ReturnType<typeof createTimekeepingOfflineStore>,
): Promise<{ completed: number; retried: number }> {
  return flushOfflineOperations(store, async ({ payload }) => {
    try {
      await recordOfflineTimeEvent({ data: payload })
      return true
    } catch {
      return false
    }
  })
}
