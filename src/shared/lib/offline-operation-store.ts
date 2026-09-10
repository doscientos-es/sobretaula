import type { OfflineOperation } from './offline-operation-queue'

export interface OfflineOperationStore<T = unknown> {
  read(): OfflineOperation<T>[]
  write(operations: OfflineOperation<T>[]): void
}

export function createLocalStorageOperationStore<T>(key: string): OfflineOperationStore<T> {
  return {
    read() {
      if (typeof localStorage === 'undefined') return []
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
        return Array.isArray(value) ? (value as OfflineOperation<T>[]) : []
      } catch {
        return []
      }
    },
    write(operations) {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(key, JSON.stringify(operations))
    },
  }
}
