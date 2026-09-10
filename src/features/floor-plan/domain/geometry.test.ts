import { describe, expect, it } from 'vitest'

import {
  findPlacementCollisions,
  isPlacementWithinBounds,
  movePlacement,
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

  it('keeps placements within the declared plan bounds', () => {
    expect(isPlacementWithinBounds(table, { heightCm: 100, widthCm: 100 })).toBe(true)
    expect(isPlacementWithinBounds({ ...table, xCm: 1 }, { heightCm: 100, widthCm: 100 })).toBe(
      false,
    )
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
