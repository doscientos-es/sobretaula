import { describe, expect, it } from 'vitest'

import {
  createSeatReservationOperation,
  createSeatWaitlistOperation,
  createSeatWalkInOperation,
} from './service-offline-operations'

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

  it('keeps walk-ins and waitlist seating serializable for the same runner', () => {
    const walkIn = createSeatWalkInOperation({
      covers: 3,
      tableIds: ['00000000-0000-0000-0000-000000000001'],
      tenantId: '00000000-0000-0000-0000-000000000002',
      venueId: '00000000-0000-0000-0000-000000000003',
    })
    const waitlist = createSeatWaitlistOperation({
      tableIds: ['00000000-0000-0000-0000-000000000001'],
      tenantId: '00000000-0000-0000-0000-000000000002',
      venueId: '00000000-0000-0000-0000-000000000003',
      waitlistEntryId: '00000000-0000-0000-0000-000000000004',
    })

    expect(walkIn.payload.kind).toBe('seat-walk-in')
    expect(waitlist.payload.kind).toBe('seat-waitlist')
    expect(walkIn.payload.operationId).not.toBe(waitlist.payload.operationId)
  })
})
