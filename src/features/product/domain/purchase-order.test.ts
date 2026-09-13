import { describe, expect, it } from 'vitest'

import { canAdvancePurchaseOrder, validatePurchaseOrderLines } from './purchase-order'

describe('purchase orders', () => {
  it('enforces approval lifecycle', () => {
    expect(canAdvancePurchaseOrder('draft', 'approved')).toBe(true)
    expect(canAdvancePurchaseOrder('draft', 'sent')).toBe(false)
    expect(canAdvancePurchaseOrder('received', 'sent')).toBe(false)
  })
  it('rejects empty, invalid and duplicate lines', () => {
    expect(validatePurchaseOrderLines([])).toBe('purchase_order_requires_lines')
    expect(validatePurchaseOrderLines([{ ingredientId: '', quantity: 1, unitCostCents: 1 }])).toBe(
      'purchase_order_invalid_line',
    )
    expect(
      validatePurchaseOrderLines([
        { ingredientId: 'a', quantity: 1, unitCostCents: 1 },
        { ingredientId: 'a', quantity: 2, unitCostCents: 1 },
      ]),
    ).toBe('purchase_order_duplicate_ingredient')
  })
})
