import { describe, expect, it } from 'vitest'

import {
  closeSessionInput,
  mergeSessionsInput,
  moveSessionInput,
  noShowReservationInput,
  requireServiceEditor,
  requireWaitlistEditor,
  seatWaitlistEntryInput,
  seatWalkInInput,
  waitlistEntryInput,
} from './service-schema'

const tenantId = '00000000-0000-4000-8000-000000000001'
const venueId = '00000000-0000-4000-8000-000000000002'
const tableId = '00000000-0000-4000-8000-000000000003'
const sessionId = '00000000-0000-4000-8000-000000000004'
const otherSessionId = '00000000-0000-4000-8000-000000000005'
const waitlistEntryId = '00000000-0000-4000-8000-000000000006'

describe('requireServiceEditor', () => {
  it('allows anyone who works the room', () => {
    for (const role of ['owner', 'manager', 'host', 'waiter']) {
      expect(() => requireServiceEditor(role)).not.toThrow()
    }
  })

  it('rejects roles without service access', () => {
    expect(() => requireServiceEditor('accountant')).toThrow()
    expect(() => requireServiceEditor('unknown')).toThrow()
  })
})

describe('requireWaitlistEditor', () => {
  it('allows the floor manager but not the waiter', () => {
    for (const role of ['owner', 'manager', 'host']) {
      expect(() => requireWaitlistEditor(role)).not.toThrow()
    }
    expect(() => requireWaitlistEditor('waiter')).toThrow()
  })
})

describe('seatWalkInInput', () => {
  it('accepts a walk-in within capacity bounds', () => {
    expect(
      seatWalkInInput.safeParse({
        covers: 2,
        tableIds: [tableId],
        tenantId,
        venueId,
      }).success,
    ).toBe(true)
  })

  it('rejects zero covers, an empty table list and more than six tables', () => {
    expect(
      seatWalkInInput.safeParse({
        covers: 0,
        tableIds: [tableId],
        tenantId,
        venueId,
      }).success,
    ).toBe(false)
    expect(seatWalkInInput.safeParse({ covers: 2, tableIds: [], tenantId, venueId }).success).toBe(
      false,
    )
    expect(
      seatWalkInInput.safeParse({
        covers: 2,
        tableIds: Array.from({ length: 7 }, () => tableId),
        tenantId,
        venueId,
      }).success,
    ).toBe(false)
  })
})

describe('moveSessionInput', () => {
  it('requires at least one destination table', () => {
    expect(
      moveSessionInput.safeParse({
        sessionId,
        tableIds: [tableId],
        tenantId,
        venueId,
      }).success,
    ).toBe(true)
    expect(moveSessionInput.safeParse({ sessionId, tableIds: [], tenantId, venueId }).success).toBe(
      false,
    )
  })
})

describe('mergeSessionsInput', () => {
  it('rejects merging a session with itself', () => {
    const result = mergeSessionsInput.safeParse({
      sourceSessionId: sessionId,
      targetSessionId: sessionId,
      tenantId,
      venueId,
    })
    expect(result.success).toBe(false)
  })

  it('accepts merging two distinct sessions', () => {
    expect(
      mergeSessionsInput.safeParse({
        sourceSessionId: sessionId,
        targetSessionId: otherSessionId,
        tenantId,
        venueId,
      }).success,
    ).toBe(true)
  })
})

describe('closeSessionInput', () => {
  it('accepts a bare session reference', () => {
    expect(closeSessionInput.safeParse({ sessionId, tenantId, venueId }).success).toBe(true)
  })
})

describe('reservation action input', () => {
  it('accepts a reservation reference scoped to a venue', () => {
    expect(
      noShowReservationInput.safeParse({
        reservationId: sessionId,
        tenantId,
        venueId,
      }).success,
    ).toBe(true)
  })

  it('rejects malformed reservation references', () => {
    expect(
      noShowReservationInput.safeParse({
        reservationId: 'not-a-uuid',
        tenantId,
        venueId,
      }).success,
    ).toBe(false)
  })
})

describe('waitlistEntryInput', () => {
  it('allows an unknown wait time but rejects a negative one', () => {
    expect(
      waitlistEntryInput.safeParse({
        estimatedWaitMinutes: null,
        partySize: 4,
        tenantId,
        venueId,
      }).success,
    ).toBe(true)
    expect(
      waitlistEntryInput.safeParse({
        estimatedWaitMinutes: -5,
        partySize: 4,
        tenantId,
        venueId,
      }).success,
    ).toBe(false)
  })
})

describe('seatWaitlistEntryInput', () => {
  it('combines the waitlist reference with the chosen tables', () => {
    expect(
      seatWaitlistEntryInput.safeParse({
        tableIds: [tableId],
        tenantId,
        venueId,
        waitlistEntryId,
      }).success,
    ).toBe(true)
  })
})
