import { describe, expect, it } from 'vitest'

import { createTimekeepingOfflineOperation } from './timekeeping-offline-operations'

describe('timekeeping offline operations', () => {
  it('keeps a client timestamp and a stable operation id for retries', () => {
    const operation = createTimekeepingOfflineOperation({
      clientOccurredAt: '2026-01-01T10:00:00.000Z',
      employeeId: '00000000-0000-4000-8000-000000000001',
      eventType: 'clock_in',
      operationId: '00000000-0000-4000-8000-000000000004',
      tenantId: '00000000-0000-4000-8000-000000000002',
      venueId: '00000000-0000-4000-8000-000000000003',
    })

    expect(operation.id).toBe('timekeeping-event:00000000-0000-4000-8000-000000000004')
    expect(operation.payload.clientOccurredAt).toBe('2026-01-01T10:00:00.000Z')
    expect(operation.payload.kind).toBe('timekeeping-event')
  })
})
