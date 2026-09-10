import { describe, expect, it } from 'vitest'

import {
  inspectServiceTableGroupPreset,
  kitchenLoadState,
  kitchenStationLoadState,
  compareServiceHandover,
  buildServiceHandover,
  buildServiceTableStates,
  findSeatingConflicts,
  mergeTableIds,
  planSessionSplit,
  seatingCapacity,
  sessionElapsedMinutes,
  sessionPacingState,
  suggestTableCombination,
  type ServiceReservation,
  type ServiceBoard,
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

  it('protects a free-looking table when its next reservation is inside the buffer', () => {
    const states = buildServiceTableStates({
      now,
      reservations: [{ ...soonReservation, startsAt: '2026-09-09T22:00:00.000Z' }],
      sessions: [],
      tables,
    })
    expect(states.find((state) => state.id === 'table-2')).toMatchObject({
      nextReservationStartsAt: '2026-09-09T22:00:00.000Z',
      status: 'free',
    })
    expect(suggestTableCombination(states, 2, undefined, false, now, 240)).toEqual(['table-1'])
  })

  it('prefers a less loaded area when capacity and table count tie', () => {
    const candidates = [
      {
        code: '1',
        id: 'table-1',
        areaId: 'busy',
        maxSeats: 2,
        minSeats: 1,
        status: 'free' as const,
        covers: null,
        sessionId: null,
        reservationId: null,
      },
      {
        code: '2',
        id: 'table-2',
        areaId: 'quiet',
        maxSeats: 2,
        minSeats: 1,
        status: 'free' as const,
        covers: null,
        sessionId: null,
        reservationId: null,
      },
    ]
    expect(
      suggestTableCombination(candidates, 2, undefined, false, now, 0, { busy: 4, quiet: 0 }),
    ).toEqual(['table-2'])
  })

  it('marks blocked tables and excludes them from suggestions', () => {
    const states = buildServiceTableStates({
      now,
      reservations: [],
      sessions: [],
      tables: [
        {
          blockReason: 'Mantenimiento',
          code: '1',
          id: 'table-1',
          isBlocked: true,
          maxSeats: 4,
          minSeats: 2,
        },
        { code: '2', id: 'table-2', maxSeats: 2, minSeats: 1 },
      ],
    })

    expect(states[0]).toMatchObject({ blockReason: 'Mantenimiento', status: 'blocked' })
    expect(suggestTableCombination(states, 2)).toEqual(['table-2'])
  })

  it('marks tables pending cleaning as unavailable', () => {
    const states = buildServiceTableStates({
      now,
      reservations: [],
      sessions: [],
      tables: [{ code: '1', id: 'table-1', isPendingCleaning: true, maxSeats: 4, minSeats: 2 }],
    })

    expect(states[0]).toMatchObject({ status: 'cleaning' })
    expect(suggestTableCombination(states, 2)).toBeUndefined()
  })

  it('calculates pacing from the session start', () => {
    const current = new Date('2026-09-09T20:45:00.000Z')
    expect(sessionElapsedMinutes(session, current)).toBe(125)
    expect(sessionPacingState(session, current)).toBe('attention')
    expect(sessionPacingState(session, current, 130)).toBe('on_track')
  })

  it('uses the board pacing target in handover summaries', () => {
    const board: ServiceBoard = {
      pacingTargetMinutes: 60,
      reservations: [],
      sessions: [session],
      tables: [
        {
          areaId: 'area-1',
          code: '1',
          covers: 3,
          id: 'table-1',
          maxSeats: 4,
          minSeats: 2,
          reservationId: null,
          sessionId: session.id,
          status: 'occupied',
        },
      ],
      waitlist: [],
    }
    expect(
      buildServiceHandover(board, new Date('2026-09-09T20:00:00.000Z'))[0]?.attentionSessions,
    ).toBe(1)
  })

  it('flags kitchen load only at the configured order threshold', () => {
    expect(kitchenLoadState(11, 12)).toBe('normal')
    expect(kitchenLoadState(12, 12)).toBe('attention')
  })

  it('flags individual kitchen stations independently', () => {
    expect(kitchenStationLoadState({ hot: 60, cold: 20 }, 60)).toEqual({
      cold: 'normal',
      hot: 'attention',
    })
  })

  it('compares a saved handover with the current state by area', () => {
    const saved = [
      {
        activeSessions: 1,
        assignedStaffIds: [],
        attentionSessions: 0,
        areaId: 'area-1',
        blockedTables: 1,
        cleaningTables: 0,
      },
    ]
    const current = [
      {
        activeSessions: 2,
        assignedStaffIds: [],
        attentionSessions: 0,
        areaId: 'area-1',
        blockedTables: 0,
        cleaningTables: 0,
      },
    ]
    expect(compareServiceHandover(saved, current)[0]).toMatchObject({
      activeSessionsDelta: 1,
      blockedTablesDelta: -1,
    })
    expect(compareServiceHandover(saved, []).at(0)).toMatchObject({
      activeSessionsDelta: -1,
      blockedTablesDelta: -1,
    })
  })

  it('builds a handover summary with live operational alerts', () => {
    const board: ServiceBoard = {
      areaStaffAssignments: { 'area-1': ['user-1'] },
      reservations: [],
      sessions: [session],
      staff: [],
      tables: [
        {
          areaId: 'area-1',
          code: '1',
          covers: 3,
          id: 'table-1',
          maxSeats: 4,
          minSeats: 2,
          reservationId: null,
          sessionId: session.id,
          status: 'occupied',
        },
        {
          areaId: 'area-1',
          code: '2',
          covers: null,
          id: 'table-2',
          maxSeats: 2,
          minSeats: 1,
          reservationId: null,
          sessionId: null,
          status: 'cleaning',
        },
        {
          areaId: 'area-1',
          code: '3',
          covers: null,
          id: 'table-3',
          maxSeats: 6,
          minSeats: 4,
          reservationId: null,
          sessionId: null,
          status: 'blocked',
        },
      ],
      waitlist: [],
    }
    expect(buildServiceHandover(board, new Date('2026-09-09T20:45:00.000Z'))[0]).toMatchObject({
      activeSessions: 1,
      attentionSessions: 1,
      assignedStaffIds: ['user-1'],
      blockedTables: 1,
      cleaningTables: 1,
    })
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

  it('does not combine tables across areas', () => {
    const first = {
      areaId: 'area-1',
      code: '1',
      covers: null,
      id: 'table-1',
      maxSeats: 4,
      minSeats: 2,
      reservationId: null,
      sessionId: null,
      status: 'free' as const,
    }
    const second = {
      ...first,
      areaId: 'area-2',
      code: '2',
      id: 'table-2',
      maxSeats: 2,
      minSeats: 1,
    }
    expect(suggestTableCombination([first, second], 5, 'area-1')).toBeUndefined()
    expect(suggestTableCombination([first, second], 4, 'area-1', true)).toBeUndefined()
    expect(
      suggestTableCombination([{ ...first, isAccessible: true }, second], 4, 'area-1', true),
    ).toEqual(['table-1'])
  })

  it('plans a safe session split in pure domain code', () => {
    const session = { covers: 4, tableIds: ['table-1', 'table-2'] }
    expect(planSessionSplit(session, ['table-1'], 2)).toEqual({
      ok: true,
      remainingTableIds: ['table-2'],
    })
    expect(planSessionSplit(session, ['gone'], 2)).toEqual({ ok: false, reason: 'unknown_table' })
    expect(planSessionSplit(session, ['table-1', 'table-2'], 2)).toEqual({
      ok: false,
      reason: 'all_tables',
    })
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

  it('uses explicit preferred areas as a tie-breaker', () => {
    const states = buildServiceTableStates({ now, reservations: [], sessions: [], tables })
    const [first, second] = states
    if (!first || !second) throw new Error('test fixture incomplete')
    expect(
      suggestTableCombination(
        [
          { ...first, maxSeats: 4, areaId: 'salon' },
          { ...second, maxSeats: 4, areaId: 'terraza' },
        ],
        4,
        undefined,
        false,
        now,
        120,
        {},
        ['area:terraza'],
      ),
    ).toEqual([second.id])
  })

  it('prefers the less-loaded kitchen zone after preferences tie', () => {
    const states = buildServiceTableStates({ now, reservations: [], sessions: [], tables })
    const [first, second] = states
    if (!first || !second) throw new Error('test fixture incomplete')
    expect(
      suggestTableCombination(
        [
          { ...first, maxSeats: 4, areaId: 'salon' },
          { ...second, maxSeats: 4, areaId: 'terraza' },
        ],
        4,
        undefined,
        false,
        now,
        120,
        {},
        [],
        { salon: 10, terraza: 2 },
      ),
    ).toEqual([second.id])
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
