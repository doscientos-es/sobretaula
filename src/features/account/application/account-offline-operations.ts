import { createOfflineOperation, type OfflineOperation } from '@/shared/lib/offline-operation-queue'
import { flushOfflineOperations } from '@/shared/lib/offline-operation-runner'
import { createLocalStorageOperationStore } from '@/shared/lib/offline-operation-store'

import { addOrderItem, reactivateOrderItem, removeOrderItem, updateOrderItem } from './account'

export interface AddOrderItemOperation {
  kind: 'add-order-item'
  menuItemId: string
  modifierOptionIds?: string[]
  notes?: string
  operationId: string
  quantity: number
  sessionId: string
  tenantId: string
  venueId: string
}

export interface UpdateOrderItemOperation {
  kind: 'update-order-item'
  notes: string | null
  orderItemId: string
  quantity: number
  sessionId: string
  tenantId: string
  venueId: string
}

export interface RemoveOrderItemOperation {
  kind: 'remove-order-item'
  orderItemId: string
  reason: string
  sessionId: string
  tenantId: string
  venueId: string
}

export interface ReactivateOrderItemOperation {
  kind: 'reactivate-order-item'
  orderItemId: string
  sessionId: string
  tenantId: string
  venueId: string
}

export type AccountOfflineOperation =
  | AddOrderItemOperation
  | UpdateOrderItemOperation
  | RemoveOrderItemOperation
  | ReactivateOrderItemOperation

export function createAddOrderItemOperation(
  input: Omit<AddOrderItemOperation, 'kind'>,
): OfflineOperation<AddOrderItemOperation> {
  return createOfflineOperation(`add-order-item:${input.operationId}`, {
    kind: 'add-order-item',
    ...input,
  })
}

export function createUpdateOrderItemOperation(
  operationId: string,
  input: Omit<UpdateOrderItemOperation, 'kind'>,
): OfflineOperation<UpdateOrderItemOperation> {
  return createOfflineOperation(`update-order-item:${operationId}`, {
    kind: 'update-order-item',
    ...input,
  })
}

export function createRemoveOrderItemOperation(
  operationId: string,
  input: Omit<RemoveOrderItemOperation, 'kind'>,
): OfflineOperation<RemoveOrderItemOperation> {
  return createOfflineOperation(`remove-order-item:${operationId}`, {
    kind: 'remove-order-item',
    ...input,
  })
}

export function createReactivateOrderItemOperation(
  operationId: string,
  input: Omit<ReactivateOrderItemOperation, 'kind'>,
): OfflineOperation<ReactivateOrderItemOperation> {
  return createOfflineOperation(`reactivate-order-item:${operationId}`, {
    kind: 'reactivate-order-item',
    ...input,
  })
}

export function createAccountOfflineStore(tenantId: string, venueId: string) {
  return createLocalStorageOperationStore<AccountOfflineOperation>(
    `sobretaula:account-offline:${tenantId}:${venueId}`,
  )
}

export function enqueueAccountOperation(
  store: ReturnType<typeof createAccountOfflineStore>,
  operation: OfflineOperation<AccountOfflineOperation>,
): void {
  store.write([...store.read().filter((current) => current.id !== operation.id), operation])
}

export function flushAccountOperations(
  store: ReturnType<typeof createAccountOfflineStore>,
): Promise<{ completed: number; retried: number }> {
  return flushOfflineOperations(store, async ({ payload }) => {
    try {
      switch (payload.kind) {
        case 'add-order-item': {
          const { kind: _, ...data } = payload
          await addOrderItem({ data })
          break
        }
        case 'update-order-item': {
          const { kind: _, ...data } = payload
          await updateOrderItem({ data })
          break
        }
        case 'remove-order-item': {
          const { kind: _, ...data } = payload
          await removeOrderItem({ data })
          break
        }
        case 'reactivate-order-item': {
          const { kind: _, ...data } = payload
          await reactivateOrderItem({ data })
          break
        }
      }
      return true
    } catch {
      return false
    }
  })
}
