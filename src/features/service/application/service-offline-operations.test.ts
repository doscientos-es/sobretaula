import { describe, expect, it } from 'vitest'

import { createSeatReservationOperation } from './service-offline-operations'

describe('service offline operations', () => {
  it('creates an idempotent seat operation with a stable operation id', () => {
    const operation = createSeatReservationOperation({
      reservationId: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000002',
      venueId: '00000000-0000-0000-0000-000000000003',
    })

    expect(operation.payload.kind).toBe('seat-reservation')
    expect(operation.payload.operationId).toMatch(/^[0-9a-f-]{36}$/)
    expect(operation.id).toContain(operation.payload.operationId)
  })
})
