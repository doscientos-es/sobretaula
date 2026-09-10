import { describe, expect, it } from 'vitest'

import { findEventTemplateConflicts, isEventLayoutTemplateValid } from './event-layout-template'

const layout = {
  format: 'sobretaula-floor-plan-template' as const,
  version: 1 as const,
  widthCm: 100,
  heightCm: 100,
  tables: [],
  elements: [],
}

describe('event layout templates', () => {
  it('validates a named template with an active interval', () => {
    expect(
      isEventLayoutTemplateValid({
        id: 'a',
        name: 'Cena',
        activeFrom: '2026-09-10T19:00:00Z',
        areaIds: ['terrace'],
        layout,
      }),
    ).toBe(true)
    expect(
      isEventLayoutTemplateValid({
        id: 'a',
        name: ' ',
        activeFrom: '2026-09-10T19:00:00Z',
        areaIds: [],
        layout,
      }),
    ).toBe(false)
  })

  it('detects overlapping templates only when an area is shared', () => {
    const base = {
      name: 'Evento',
      activeFrom: '2026-09-10T19:00:00Z',
      activeTo: '2026-09-10T23:00:00Z',
      layout,
    }
    expect(
      findEventTemplateConflicts([
        { ...base, id: 'a', areaIds: ['terrace'] },
        { ...base, id: 'b', areaIds: ['terrace', 'salon'] },
        { ...base, id: 'c', areaIds: ['salon'], activeFrom: '2026-09-11T19:00:00Z' },
      ]),
    ).toEqual([{ firstTemplateId: 'a', secondTemplateId: 'b', areaId: 'terrace' }])
  })
})
