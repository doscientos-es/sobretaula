import { describe, expect, it } from 'vitest'

import { groupAreasByFloor } from './floor-plan'

describe('floor plan areas', () => {
  it('groups areas by floor and keeps legacy areas compatible', () => {
    const groups = groupAreasByFloor([
      { id: 'terrace', name: 'Terraza', venueId: 'v', isOnlineBookable: true, floorNumber: 1 },
      { id: 'main', name: 'Sala', venueId: 'v', isOnlineBookable: true, floorNumber: 0 },
      { id: 'legacy', name: 'Antigua', venueId: 'v', isOnlineBookable: true },
    ])
    expect(groups.map((group) => group.label)).toEqual(['Sin planta asignada', 'Planta baja', 'Planta 1'])
    expect(groups[1]?.areas[0]?.id).toBe('main')
  })
})
