import { describe, expect, it } from 'vitest'

import {
  inspectTableGroupPresetAvailability,
  normalizeTableGroupPreset,
} from './table-group-presets'

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

describe('inspectTableGroupPresetAvailability', () => {
  it('reports missing tables and capacity without mutating the preset', () => {
    const preset = normalizeTableGroupPreset({
      name: 'Familia',
      tableIds: ['a', 'b'],
      maxSeats: 8,
    })!
    expect(
      inspectTableGroupPresetAvailability(
        preset,
        new Map([
          ['a', 4],
          ['b', 4],
        ]),
      ),
    ).toEqual({
      availableTableIds: ['a', 'b'],
      missingTableIds: [],
      totalSeats: 8,
      fitsCapacity: true,
    })
    expect(preset.tableIds).toEqual(['a', 'b'])
  })

  it('rejects stale or over-capacity combinations', () => {
    const preset = normalizeTableGroupPreset({ name: 'Terraza', tableIds: ['a', 'gone'], maxSeats: 6 })!
    expect(inspectTableGroupPresetAvailability(preset, new Map([['a', 8]])).fitsCapacity).toBe(false)
  })
})
