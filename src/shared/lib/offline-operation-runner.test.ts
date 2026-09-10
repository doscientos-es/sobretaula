import { describe, expect, it } from 'vitest'

import { createOfflineOperation } from './offline-operation-queue'
import { flushOfflineOperations } from './offline-operation-runner'
import type { OfflineOperationStore } from './offline-operation-store'

describe('offline operation runner', () => {
  it('deduplicates ids and persists successful and retried operations', async () => {
    let operations = [
      createOfflineOperation('same', { value: 1 }),
      createOfflineOperation('same', { value: 2 }),
      createOfflineOperation('retry', { value: 3 }),
    ]
    const store: OfflineOperationStore<{ value: number }> = {
      read: () => operations,
      write: (next) => {
        operations = next
      },
    }
    const result = await flushOfflineOperations(store, async (operation) => operation.id === 'same')
    expect(result).toEqual({ completed: 1, retried: 1 })
    expect(operations.map((operation) => operation.id)).toEqual(['retry'])
    expect(operations[0]?.attempts).toBe(1)
  })
})
