import { describe, expect, it } from 'vitest'

import {
  createIngredientInput,
  inventoryMovementInput,
  requireProductEditor,
} from './product-schema'

describe('product permissions', () => {
  it.each(['owner', 'manager'] as const)('allows %s to manage recipes and inventory', (role) => {
    expect(() => requireProductEditor(role)).not.toThrow()
  })

  it.each(['host', 'waiter', 'accountant'] as const)(
    'denies %s from mutating product data',
    (role) => {
      expect(() => requireProductEditor(role)).toThrow(Response)
    },
  )
})

describe('inventory movement semantics', () => {
  const base = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    venueId: '00000000-0000-0000-0000-000000000002',
    ingredientId: '00000000-0000-0000-0000-000000000003',
    reason: 'test',
  }
  it('rejects positive waste and negative purchases', () => {
    expect(inventoryMovementInput.safeParse({ ...base, kind: 'waste', quantity: 1 }).success).toBe(
      false,
    )
    expect(
      inventoryMovementInput.safeParse({ ...base, kind: 'purchase', quantity: -1 }).success,
    ).toBe(false)
  })
  it('accepts a negative waste movement', () => {
    expect(
      inventoryMovementInput.safeParse({
        ...base,
        kind: 'waste',
        quantity: -1,
        wasteReason: 'expiry',
      }).success,
    ).toBe(true)
  })
})

describe('ingredient dietary semantics', () => {
  const base = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'Pan de prueba',
    unit: 'g' as const,
    costCentsPerUnit: 1,
    minimumStock: 0,
  }
  it('rejects vegan ingredients with animal-derived allergens', () => {
    expect(
      createIngredientInput.safeParse({ ...base, isVegan: true, allergens: ['milk'] }).success,
    ).toBe(false)
  })
  it('allows vegan ingredients with plant-compatible allergens', () => {
    expect(
      createIngredientInput.safeParse({ ...base, isVegan: true, allergens: ['gluten', 'nuts'] })
        .success,
    ).toBe(true)
  })
})
