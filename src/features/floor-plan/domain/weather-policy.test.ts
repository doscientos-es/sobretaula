import { describe, expect, it } from 'vitest'

import {
  decideTerraceWeatherAction,
  planTerraceClosure,
  planTerraceTransfer,
  shouldReviewTerraceTransfer,
} from './weather-policy'

describe('terrace weather policy', () => {
  it('moves outdoor service inside for rain, storm or strong wind', () => {
    expect(
      decideTerraceWeatherAction({
        condition: 'rain',
        precipitationProbability: 10,
        windKph: 0,
        temperatureC: 20,
      }),
    ).toBe('move_inside')
    expect(
      decideTerraceWeatherAction({
        condition: 'clear',
        precipitationProbability: 10,
        windKph: 40,
        temperatureC: 20,
      }),
    ).toBe('move_inside')
  })

  it('asks the manager to review extreme heat', () => {
    const snapshot = {
      condition: 'heat' as const,
      precipitationProbability: 0,
      windKph: 5,
      temperatureC: 36,
    }
    expect(decideTerraceWeatherAction(snapshot)).toBe('review')
    expect(shouldReviewTerraceTransfer(snapshot)).toBe(true)
  })

  it('keeps a mild clear terrace open', () => {
    expect(
      decideTerraceWeatherAction({
        condition: 'clear',
        precipitationProbability: 10,
        windKph: 5,
        temperatureC: 22,
      }),
    ).toBe('keep_outdoor')
  })

  it('plans deterministic indoor moves and leaves overflow visible', () => {
    expect(
      planTerraceTransfer(
        [
          { id: 'large', covers: 5, tableIds: ['terrace-1'] },
          { id: 'small', covers: 2, tableIds: ['terrace-2'] },
        ],
        [
          { id: 'inside-2', capacity: 2 },
          { id: 'inside-4', capacity: 4 },
          { id: 'inside-6', capacity: 6 },
        ],
        ['inside-4'],
      ),
    ).toEqual({
      moves: [
        { reservationId: 'large', tableIds: ['inside-6'] },
        { reservationId: 'small', tableIds: ['inside-2'] },
      ],
      unassignedReservationIds: [],
    })
  })

  it('blocks closing a terrace with active sessions or reservations', () => {
    expect(
      planTerraceClosure({
        terraceTableIds: ['terrace-1'],
        activeSessions: [{ id: 'session-1', tableIds: ['terrace-1'] }],
        reservations: [{ id: 'reservation-1', tableIds: ['terrace-1'] }],
      }),
    ).toEqual({
      canClose: false,
      activeSessionIds: ['session-1'],
      reservationIds: ['reservation-1'],
    })
    expect(
      planTerraceClosure({ terraceTableIds: ['terrace-1'], activeSessions: [], reservations: [] })
        .canClose,
    ).toBe(true)
  })
})
