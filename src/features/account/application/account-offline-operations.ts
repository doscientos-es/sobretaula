import { createOfflineOperation, type OfflineOperation } from '@/shared/lib/offline-operation-queue'
import { flushOfflineOperations } from '@/shared/lib/offline-operation-runner'
import { createLocalStorageOperationStore } from '@/shared/lib/offline-operation-store'

import { addOrderItem } from './account'

export interface AddOrderItemOperation {
  kind: 'add-order-item'
  menuItemId: string
  notes?: string
  operationId: string
  quantity: number
  sessionId: string
  tenantId: string
  venueId: string
}

export function createAddOrderItemOperation(
  input: Omit<AddOrderItemOperation, 'kind'>,
): OfflineOperation<AddOrderItemOperation> {
  return createOfflineOperation(`add-order-item:${input.operationId}`, {
    kind: 'add-order-item',
    ...input,
  })
}

export function createAccountOfflineStore(tenantId: string, venueId: string) {
  return createLocalStorageOperationStore<AddOrderItemOperation>(
    `sobretaula:account-offline:${tenantId}:${venueId}`,
  )
}

export function enqueueAccountOperation(
  store: ReturnType<typeof createAccountOfflineStore>,
  operation: OfflineOperation<AddOrderItemOperation>,
): void {
  store.write([...store.read().filter((current) => current.id !== operation.id), operation])
}

export function flushAccountOperations(
  store: ReturnType<typeof createAccountOfflineStore>,
): Promise<{ completed: number; retried: number }> {
  return flushOfflineOperations(store, async ({ payload }) => {
    try {
      const { kind: _, ...data } = payload
      await addOrderItem({ data })
      return true
    } catch {
      return false
    }
  })
}
