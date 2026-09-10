import { beforeEach, describe, expect, it } from 'vitest'

import { createOfflineOperation } from './offline-operation-queue'
import { createLocalStorageOperationStore } from './offline-operation-store'

describe('local offline operation store', () => {
  const data = new Map<string, string>()
  beforeEach(() => {
    data.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        clear: () => data.clear(),
      },
    })
  })

  it('persists and reads operations', () => {
    const store = createLocalStorageOperationStore<{ action: string }>('ops')
    const operation = createOfflineOperation('session-1', { action: 'seat' })
    store.write([operation])
    expect(store.read()).toEqual([operation])
  })

  it('returns an empty queue when stored data is invalid', () => {
    localStorage.setItem('ops', '{broken')
    expect(createLocalStorageOperationStore('ops').read()).toEqual([])
  })
})
