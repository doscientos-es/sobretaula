import { isReadyForRetry, scheduleRetry, type OfflineOperation } from './offline-operation-queue'
import type { OfflineOperationStore } from './offline-operation-store'

export async function flushOfflineOperations<T>(
  store: OfflineOperationStore<T>,
  execute: (operation: OfflineOperation<T>) => Promise<boolean>,
  now = new Date(),
): Promise<{ completed: number; retried: number }> {
  const operations = store.read()
  const pending = new Map<string, OfflineOperation<T>>()
  for (const operation of operations) pending.set(operation.id, operation)
  let completed = 0
  let retried = 0
  for (const operation of pending.values()) {
    if (!isReadyForRetry(operation, now)) continue
    if (await execute(operation)) {
      pending.delete(operation.id)
      completed += 1
    } else {
      pending.set(operation.id, scheduleRetry(operation, now))
      retried += 1
    }
  }
  store.write([...pending.values()])
  return { completed, retried }
}
