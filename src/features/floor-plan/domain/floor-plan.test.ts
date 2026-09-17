import { describe, expect, it } from 'vitest'

import { describeSpaceType, groupAreasByFloor } from './floor-plan'

describe('floor plan zones', () => {
  it('groups each map zone under its floor with stable labels', () => {
    expect(
      groupAreasByFloor([
        {
          id: 'terrace',
          isOnlineBookable: true,
          name: 'Terraza',
          venueId: 'venue',
          floorNumber: 1,
          heightCm: 600,
          widthCm: 800,
        },
        {
          id: 'room',
          isOnlineBookable: true,
          name: 'Sala',
          venueId: 'venue',
          floorNumber: 0,
          heightCm: 600,
          widthCm: 800,
        },
        {
          id: 'bar',
          isOnlineBookable: true,
          name: 'Barra',
          venueId: 'venue',
          heightCm: 600,
          widthCm: 800,
        },
      ]).map(({ label, areas }) => ({ label, areaIds: areas.map((area) => area.id) })),
    ).toEqual([
      { label: 'Sin planta asignada', areaIds: ['bar'] },
      { label: 'Planta baja', areaIds: ['room'] },
      { label: 'Planta 1', areaIds: ['terrace'] },
    ])
  })
})

describe('floor plan space types', () => {
  it('uses safe labels for terraces and legacy values', () => {
    expect(describeSpaceType('covered_terrace')).toBe('Terraza cubierta')
    expect(describeSpaceType('outdoor_terrace')).toBe('Terraza exterior')
    expect(describeSpaceType(undefined)).toBe('Zona')
  })
})
