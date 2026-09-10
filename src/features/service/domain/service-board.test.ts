import { describe, expect, it } from 'vitest'

import {
  inspectServiceTableGroupPreset,
  buildServiceTableStates,
  findSeatingConflicts,
  mergeTableIds,
  seatingCapacity,
  suggestTableCombination,
  type ServiceReservation,
  type ServiceSession,
  type ServiceTable,
} from './service-board'

const now = new Date('2026-09-09T19:00:00.000Z')

const tables: ServiceTable[] = [
  { code: '1', id: 'table-1', maxSeats: 4, minSeats: 2 },
  { code: '2', id: 'table-2', maxSeats: 2, minSeats: 1 },
  { code: '3', id: 'table-3', maxSeats: 6, minSeats: 4 },
]

const session: ServiceSession = {
  covers: 3,
  id: 'session-1',
  openedAt: '2026-09-09T18:40:00.000Z',
  reservationId: 'reservation-1',
  tableIds: ['table-1'],
}

const soonReservation: ServiceReservation = {
  guestName: 'Marta',
  id: 'reservation-2',
  partySize: 2,
  startsAt: '2026-09-09T19:30:00.000Z',
  tableIds: ['table-2'],
}

describe('service board', () => {
  it('marks tables as occupied, reserved or free', () => {
    const states = buildServiceTableStates({
      now,
      reservations: [soonReservation],
      sessions: [session],
      tables,
    })

    expect(states.map((state) => state.status)).toEqual(['occupied', 'reserved', 'free'])
    expect(states[0]).toMatchObject({ covers: 3, sessionId: 'session-1' })
    expect(states[1]).toMatchObject({ covers: 2, reservationId: 'reservation-2' })
  })

  it('ignores reservations beyond the upcoming window', () => {
    const states = buildServiceTableStates({
      now,
      reservations: [{ ...soonReservation, startsAt: '2026-09-09T23:00:00.000Z' }],
      sessions: [],
      tables,
    })

    expect(states.every((state) => state.status === 'free')).toBe(true)
  })

  it('marks blocked tables and excludes them from suggestions', () => {
    const states = buildServiceTableStates({
      now,
      reservations: [],
      sessions: [],
      tables: [
        { ...tables[0]!, isBlocked: true, blockReason: 'Mantenimiento' },
        tables[1]!,
      ],
    })

    expect(states[0]).toMatchObject({ blockReason: 'Mantenimiento', status: 'blocked' })
    expect(suggestTableCombination(states, 2)).toEqual(['table-2'])
  })

  it('keeps the earliest reservation when two share a table', () => {
    const later = { ...soonReservation, id: 'reservation-3', startsAt: '2026-09-09T20:30:00.000Z' }
    const states = buildServiceTableStates({
      now,
      reservations: [later, soonReservation],
      sessions: [],
      tables,
    })

    expect(states[1]?.reservationId).toBe('reservation-2')
  })

  it('lets an open session hide an approaching reservation on the same table', () => {
    const states = buildServiceTableStates({
      now,
      reservations: [{ ...soonReservation, tableIds: ['table-1'] }],
      sessions: [session],
      tables,
    })

    expect(states[0]).toMatchObject({ sessionId: 'session-1', status: 'occupied' })
  })

  it('adds up the seats of the joined tables and ignores unknown ids', () => {
    expect(seatingCapacity(tables, ['table-1', 'table-3'])).toBe(10)
    expect(seatingCapacity(tables, ['table-9'])).toBe(0)
  })

  it('reports the busy table codes except the session being moved', () => {
    const states = buildServiceTableStates({ now, reservations: [], sessions: [session], tables })

    expect(findSeatingConflicts(states, ['table-1', 'table-2'])).toEqual(['1'])
    expect(findSeatingConflicts(states, ['table-1'], 'session-1')).toEqual([])
  })

  it('joins two table sets without duplicating a shared table', () => {
    expect(mergeTableIds(['table-1', 'table-2'], ['table-2', 'table-3'])).toEqual([
      'table-1',
      'table-2',
      'table-3',
    ])
  })

  it('suggests the tightest free combination and ignores busy tables', () => {
    const states = buildServiceTableStates({ now, reservations: [], sessions: [], tables })
    const first = states[0]
    const second = states[1]
    const third = states[2]
    if (!first || !second || !third) throw new Error('test fixture incomplete')
    const busy = { ...second, status: 'occupied' as const, sessionId: 'busy', covers: 2 }
    expect(suggestTableCombination([first, busy, third], 10)).toEqual(['table-1', 'table-3'])
  })

  it('returns no suggestion for invalid or impossible groups', () => {
    const states = buildServiceTableStates({ now, reservations: [], sessions: [], tables })
    expect(suggestTableCombination(states, 0)).toBeUndefined()
    expect(suggestTableCombination(states, 99)).toBeUndefined()
  })

  it('prefers fewer tables when two combinations have the same capacity', () => {
    const states = buildServiceTableStates({ now, reservations: [], sessions: [], tables })
    const [first, second, third] = states
    if (!first || !second || !third) throw new Error('test fixture incomplete')
    const compact = { ...first, maxSeats: 6 }
    const pairA = { ...second, maxSeats: 3 }
    const pairB = { ...third, maxSeats: 3 }
    expect(suggestTableCombination([compact, pairA, pairB], 6)).toEqual(['table-1'])
  })

  it('explains why a saved table combination cannot be applied', () => {
    const states = buildServiceTableStates({ now, reservations: [], sessions: [], tables })
    const [first, second] = states
    if (!first || !second) throw new Error('test fixture incomplete')
    expect(
      inspectServiceTableGroupPreset(
        { id: 'preset', maxSeats: 8, name: 'Familia', tableIds: ['table-1', 'gone'] },
        [first, second],
      ).reason,
    ).toBe('missing_tables')
    expect(
      inspectServiceTableGroupPreset(
        { id: 'preset', maxSeats: 8, name: 'Familia', tableIds: ['table-1', 'table-2'] },
        [{ ...first, status: 'occupied', sessionId: 'busy' }, second],
      ).reason,
    ).toBe('occupied')
  })
})
