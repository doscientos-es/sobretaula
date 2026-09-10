import { describe, expect, it } from 'vitest'

import { blockAppliesToArea } from './scheduling-blocks'
describe('blockAppliesToArea', () => {
  const window = {
    startsAt: new Date('2026-01-01T12:00:00Z'),
    endsAt: new Date('2026-01-01T14:00:00Z'),
  }
  it('applies global blocks and matching area blocks', () => {
    expect(
      blockAppliesToArea(
        { ...window, areaId: null, visibleOnline: true },
        'a',
        new Date('2026-01-01T13:00:00Z'),
        new Date('2026-01-01T13:30:00Z'),
      ),
    ).toBe(true)
    expect(
      blockAppliesToArea(
        { ...window, areaId: 'a', visibleOnline: true },
        'a',
        new Date('2026-01-01T13:00:00Z'),
        new Date('2026-01-01T13:30:00Z'),
      ),
    ).toBe(true)
  })
  it('does not apply hidden or different-area blocks', () => {
    expect(
      blockAppliesToArea(
        { ...window, areaId: 'b', visibleOnline: true },
        'a',
        window.startsAt,
        window.endsAt,
      ),
    ).toBe(false)
    expect(
      blockAppliesToArea(
        { ...window, areaId: null, visibleOnline: false },
        null,
        window.startsAt,
        window.endsAt,
      ),
    ).toBe(false)
  })
})
