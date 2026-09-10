import { describe, expect, it } from 'vitest'

import {
  createLayoutTemplate,
  parseLayoutTemplate,
  serializeLayoutTemplate,
} from './layout-template'

describe('layout templates', () => {
  const input = {
    widthCm: 1000,
    heightCm: 600,
    tables: [
      {
        id: 'table-1',
        code: 'A1',
        floorPlanVersionId: 'version',
        heightCm: 80,
        widthCm: 80,
        rotationDeg: 0,
        xCm: 100,
        yCm: 100,
      },
    ],
    elements: [
      {
        id: 'door-1',
        floorPlanVersionId: 'version',
        kind: 'door' as const,
        label: 'Entrada',
        heightCm: 100,
        widthCm: 20,
        rotationDeg: 0,
        xCm: 0,
        yCm: 200,
      },
    ],
  }

  it('exports a portable versioned JSON without venue ids', () => {
    const parsed = parseLayoutTemplate(serializeLayoutTemplate(createLayoutTemplate(input)))
    expect(parsed.version).toBe(1)
    expect(parsed.tables[0]).not.toHaveProperty('id')
    expect(parsed.elements[0]).not.toHaveProperty('floorPlanVersionId')
  })

  it('rejects invalid JSON and unsupported versions', () => {
    expect(() => parseLayoutTemplate('{')).toThrow('JSON válido')
    expect(() =>
      parseLayoutTemplate(
        '{"format":"sobretaula-floor-plan-template","version":2,"widthCm":1,"heightCm":1,"tables":[],"elements":[]}',
      ),
    ).toThrow('no compatible')
  })

  it('rejects geometry outside the template bounds', () => {
    const template = createLayoutTemplate(input)
    expect(() =>
      parseLayoutTemplate(
        JSON.stringify({ ...template, tables: [{ ...template.tables[0], xCm: 950 }] }),
      ),
    ).toThrow('geometría')
  })
})
