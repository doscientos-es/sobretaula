import { describe, expect, it } from 'vitest'

import { validateDeliveryNoteLines } from './delivery-notes'

describe('validateDeliveryNoteLines', () => {
  it('requires positive, unique received lines', () => {
    expect(() => validateDeliveryNoteLines([])).toThrow('delivery_note_requires_lines')
    expect(() =>
      validateDeliveryNoteLines([
        { ingredientId: 'a', quantity: 1, unitCostCents: 2 },
        { ingredientId: 'a', quantity: 1, unitCostCents: 2 },
      ]),
    ).toThrow('delivery_note_duplicate_ingredient')
    expect(() =>
      validateDeliveryNoteLines([{ ingredientId: 'a', quantity: 0, unitCostCents: 2 }]),
    ).toThrow('delivery_note_invalid_quantity')
  })
})
