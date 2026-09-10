import { describe, expect, it } from 'vitest'

import {
  findPlacementCollisions,
  findBlockedAccesses,
  findNarrowPassages,
  isPlacementWithinBounds,
  movePlacement,
  placementBoundingBox,
  placementsOverlap,
  snapCoordinate,
  validateLayout,
  type PlanPlacement,
} from './geometry'

const table: PlanPlacement = {
  heightCm: 100,
  id: 'table-1',
  rotationDeg: 0,
  widthCm: 100,
  xCm: 0,
  yCm: 0,
}

describe('floor plan geometry', () => {
  it('detects tables blocking doors and exits, but ignores other elements', () => {
    expect(
      findBlockedAccesses(
        [table],
        [
          { ...table, id: 'door-1', kind: 'door' },
          { ...table, id: 'wall-1', kind: 'wall', xCm: 500 },
        ],
      ),
    ).toEqual([{ accessId: 'door-1', placementId: 'table-1' }])
  })
  it('snaps a moved table to the nearest grid intersection', () => {
    expect(movePlacement(table, { xCm: 37, yCm: 63 })).toMatchObject({ xCm: 25, yCm: 75 })
    expect(snapCoordinate(49, 50)).toBe(50)
  })

  it('rejects an invalid grid size', () => {
    expect(() => snapCoordinate(10, 0)).toThrow('grid_size_must_be_a_positive_integer')
  })

  it('detects overlap but lets two table edges touch', () => {
    expect(placementsOverlap(table, { ...table, id: 'table-2', xCm: 99 })).toBe(true)
    expect(placementsOverlap(table, { ...table, id: 'table-2', xCm: 100 })).toBe(false)
  })

  it('returns only other colliding placements', () => {
    const colliding = { ...table, id: 'table-2', xCm: 50 }
    const separate = { ...table, id: 'table-3', xCm: 200 }

    expect(findPlacementCollisions(table, [table, colliding, separate])).toEqual([colliding])
  })

  it('detects narrow aisles without flagging a comfortable side gap', () => {
    expect(
      findNarrowPassages(
        [table, { ...table, id: 'table-2', xCm: 150 }, { ...table, id: 'table-3', yCm: 250 }],
        60,
      ),
    ).toEqual([{ clearanceCm: 50, firstPlacementId: 'table-1', secondPlacementId: 'table-2' }])
  })

  it('keeps placements within the declared plan bounds', () => {
    expect(isPlacementWithinBounds(table, { heightCm: 100, widthCm: 100 })).toBe(true)
    expect(isPlacementWithinBounds({ ...table, xCm: 1 }, { heightCm: 100, widthCm: 100 })).toBe(
      false,
    )
  })

  it('accounts for rotated footprints when validating bounds and collisions', () => {
    const rotated = { ...table, rotationDeg: 45, xCm: 0, yCm: 0 }
    expect(isPlacementWithinBounds(rotated, { widthCm: 100, heightCm: 100 })).toBe(false)
    expect(placementsOverlap(rotated, { ...table, id: 'nearby', xCm: 90 })).toBe(true)
  })

  it('rotates around the centre without changing the footprint at right angles', () => {
    expect(placementBoundingBox({ ...table, rotationDeg: 90 })).toMatchObject({
      heightCm: 100,
      widthCm: 100,
      xCm: 0,
      yCm: 0,
    })
    expect(
      placementBoundingBox({ ...table, heightCm: 50, rotationDeg: 90, widthCm: 100 }),
    ).toMatchObject({
      heightCm: 100,
      widthCm: 50,
      xCm: 25,
      yCm: -25,
    })
  })

  it('reports invalid size, bounds and each overlap once', () => {
    const issues = validateLayout(
      [
        table,
        { ...table, id: 'table-2', xCm: 50 },
        { ...table, id: 'table-3', xCm: 500 },
        { ...table, id: 'table-4', widthCm: 0 },
      ],
      { heightCm: 500, widthCm: 500 },
    )
    expect(issues).toEqual([
      { code: 'overlap', placementId: 'table-1', relatedPlacementId: 'table-2' },
      { code: 'outside_bounds', placementId: 'table-3' },
      { code: 'invalid_size', placementId: 'table-4' },
    ])
  })
})
