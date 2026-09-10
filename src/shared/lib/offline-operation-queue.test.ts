import { describe, expect, it } from 'vitest'

import { createOfflineOperation, isReadyForRetry, scheduleRetry } from './offline-operation-queue'

describe('offline operation queue', () => {
  it('creates an operation ready immediately', () => {
    const now = new Date('2026-01-01T10:00:00.000Z')
    const operation = createOfflineOperation('walk-in:session-1', { status: 'open' }, now)
    expect(operation.attempts).toBe(0)
    expect(isReadyForRetry(operation, now)).toBe(true)
  })
  it('applies exponential backoff with a fifteen minute cap', () => {
    const now = new Date('2026-01-01T10:00:00.000Z')
    let operation = createOfflineOperation('op-1', {}, now)
    operation = scheduleRetry(operation, now)
    expect(operation.nextAttemptAt).toBe('2026-01-01T10:00:02.000Z')
    for (let index = 0; index < 10; index += 1) operation = scheduleRetry(operation, now)
    expect(new Date(operation.nextAttemptAt).getTime() - now.getTime()).toBe(15 * 60_000)
  })
})
