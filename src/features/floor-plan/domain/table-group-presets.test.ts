import { describe, expect, it } from 'vitest'

import { normalizeTableGroupPreset } from './table-group-presets'

describe('normalizeTableGroupPreset', () => {
  it('trims and deduplicates table ids', () => {
    expect(
      normalizeTableGroupPreset({
        name: '  Terraza  ',
        tableIds: [' a ', 'a', 'b'],
        maxSeats: 8.9,
      }),
    ).toEqual({
      name: 'Terraza',
      tableIds: ['a', 'b'],
      maxSeats: 8,
    })
  })

  it('rejects invalid names, groups and capacities', () => {
    expect(
      normalizeTableGroupPreset({ name: ' ', tableIds: ['a', 'b'], maxSeats: 4 }),
    ).toBeUndefined()
    expect(
      normalizeTableGroupPreset({ name: 'Grupo', tableIds: ['a'], maxSeats: 4 }),
    ).toBeUndefined()
    expect(
      normalizeTableGroupPreset({ name: 'Grupo', tableIds: ['a', 'b'], maxSeats: 0 }),
    ).toBeUndefined()
  })
})
