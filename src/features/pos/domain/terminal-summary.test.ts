import { describe, expect, it } from 'vitest'

import { summarizePosTerminal } from './terminal-summary'

describe('summarizePosTerminal', () => {
  it('groups the live room and kitchen state for the terminal home', () => {
    expect(
      summarizePosTerminal({
        kitchenTickets: [
          {
            id: 'one',
            name: 'Café',
            notes: null,
            quantity: 1,
            preparationMinutes: 1,
            station: 'bar',
            status: 'pending',
            sessionId: 's1',
            createdAt: '2026-09-10T12:00:00Z',
          },
          {
            id: 'two',
            name: 'Arroz',
            notes: null,
            quantity: 1,
            preparationMinutes: 20,
            station: 'hot',
            status: 'ready',
            sessionId: 's1',
            createdAt: '2026-09-10T12:00:00Z',
          },
        ],
        reservations: [],
        sessions: [
          {
            covers: 2,
            id: 's1',
            openedAt: '2026-09-10T12:00:00Z',
            reservationId: null,
            tableIds: ['t1'],
          },
        ],
        waitlist: [],
        tables: [
          {
            code: '1',
            covers: null,
            id: 't1',
            maxSeats: 4,
            minSeats: 1,
            reservationId: null,
            sessionId: 's1',
            status: 'occupied',
          },
          {
            code: '2',
            covers: null,
            id: 't2',
            maxSeats: 4,
            minSeats: 1,
            reservationId: null,
            sessionId: null,
            status: 'free',
          },
          {
            code: '3',
            covers: null,
            id: 't3',
            maxSeats: 4,
            minSeats: 1,
            reservationId: null,
            sessionId: null,
            status: 'reserved',
          },
          {
            code: '4',
            covers: null,
            id: 't4',
            maxSeats: 4,
            minSeats: 1,
            reservationId: null,
            sessionId: null,
            status: 'cleaning',
          },
        ],
      }),
    ).toEqual({
      activeSessions: 1,
      availableTables: 1,
      blockedTables: 0,
      cleaningTables: 1,
      pendingItems: 1,
      readyItems: 1,
      reservedTables: 1,
    })
  })
})
