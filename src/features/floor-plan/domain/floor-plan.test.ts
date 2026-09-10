import { describe, expect, it } from 'vitest'

import {
  describeSpaceType,
  findVersionScheduleConflicts,
  isFloorPlanVersionScheduleValid,
  selectActiveFloorPlanVersion,
  selectFloorPlanVersion,
} from './floor-plan'

describe('floor plan versions', () => {
  it('rejects malformed, zero-length, and reversed schedules', () => {
    const base = { areaId: 'a', heightCm: 100, id: 'v', name: 'x', widthCm: 100 }
    expect(
      isFloorPlanVersionScheduleValid({
        ...base,
        activeFrom: '2026-09-11T00:00:00Z',
        activeTo: '2026-09-10T23:59:00Z',
      }),
    ).toBe(false)
    expect(isFloorPlanVersionScheduleValid({ ...base, activeFrom: 'not-a-date' })).toBe(false)
    expect(
      isFloorPlanVersionScheduleValid({
        ...base,
        activeFrom: '2026-09-10T00:00:00Z',
        activeTo: '2026-09-10T00:00:00Z',
      }),
    ).toBe(false)
  })
  it('selects the scheduled version active at a given time', () => {
    const versions = [
      {
        id: 'normal',
        areaId: 'a',
        name: 'Normal',
        widthCm: 100,
        heightCm: 100,
        activeFrom: '2026-01-01T00:00:00Z',
        activeTo: '2026-06-01T00:00:00Z',
      },
      {
        id: 'summer',
        areaId: 'a',
        name: 'Terraza verano',
        widthCm: 100,
        heightCm: 100,
        activeFrom: '2026-06-01T00:00:00Z',
      },
    ]
    expect(selectFloorPlanVersion(versions, 'a', new Date('2026-03-01T00:00:00Z'))?.id).toBe(
      'normal',
    )
    expect(selectFloorPlanVersion(versions, 'a', new Date('2026-07-01T00:00:00Z'))?.id).toBe(
      'summer',
    )
    expect(
      selectFloorPlanVersion(versions, 'missing', new Date('2026-07-01T00:00:00Z')),
    ).toBeUndefined()
  })

  it('finds overlapping schedules only within the same area', () => {
    const conflicts = findVersionScheduleConflicts([
      {
        id: 'a',
        areaId: 'room',
        name: 'A',
        widthCm: 1,
        heightCm: 1,
        activeFrom: '2026-01-01T00:00:00Z',
        activeTo: '2026-03-01T00:00:00Z',
      },
      {
        id: 'b',
        areaId: 'room',
        name: 'B',
        widthCm: 1,
        heightCm: 1,
        activeFrom: '2026-02-01T00:00:00Z',
      },
      {
        id: 'c',
        areaId: 'terrace',
        name: 'C',
        widthCm: 1,
        heightCm: 1,
        activeFrom: '2026-02-01T00:00:00Z',
      },
    ])
    expect(conflicts).toEqual([{ areaId: 'room', firstVersionId: 'a', secondVersionId: 'b' }])
  })

  it('selects the active version globally instead of a future scheduled one', () => {
    const versions = [
      {
        id: 'future',
        areaId: 'terrace',
        name: 'Evento',
        widthCm: 1,
        heightCm: 1,
        activeFrom: '2027-01-01T00:00:00Z',
      },
      {
        id: 'current',
        areaId: 'room',
        name: 'Actual',
        widthCm: 1,
        heightCm: 1,
        activeFrom: '2026-01-01T00:00:00Z',
      },
    ]
    expect(selectActiveFloorPlanVersion(versions, new Date('2026-09-10T00:00:00Z'))?.id).toBe(
      'current',
    )
  })

  it('does not report malformed schedules as conflicts', () => {
    const versions = [
      { id: 'bad', areaId: 'room', name: 'Bad', widthCm: 1, heightCm: 1, activeFrom: 'invalid' },
      { id: 'good', areaId: 'room', name: 'Good', widthCm: 1, heightCm: 1 },
    ]
    expect(findVersionScheduleConflicts(versions)).toEqual([])
  })
})

describe('floor plan space types', () => {
  it('uses safe labels for terraces and legacy values', () => {
    expect(describeSpaceType('covered_terrace')).toBe('Terraza cubierta')
    expect(describeSpaceType('outdoor_terrace')).toBe('Terraza exterior')
    expect(describeSpaceType(undefined)).toBe('Zona')
  })
})
