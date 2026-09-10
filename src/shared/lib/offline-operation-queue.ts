export interface OfflineOperation<T = unknown> {
  id: string
  attempts: number
  createdAt: string
  payload: T
  nextAttemptAt: string
}

export function createOfflineOperation<T>(
  id: string,
  payload: T,
  now = new Date(),
): OfflineOperation<T> {
  return {
    id,
    attempts: 0,
    createdAt: now.toISOString(),
    nextAttemptAt: now.toISOString(),
    payload,
  }
}

export function scheduleRetry<T>(
  operation: OfflineOperation<T>,
  now = new Date(),
): OfflineOperation<T> {
  const attempts = operation.attempts + 1
  const delayMs = Math.min(15 * 60_000, 1_000 * 2 ** Math.min(attempts, 10))
  return { ...operation, attempts, nextAttemptAt: new Date(now.getTime() + delayMs).toISOString() }
}

export function isReadyForRetry(operation: OfflineOperation, now = new Date()): boolean {
  return new Date(operation.nextAttemptAt).getTime() <= now.getTime()
}
