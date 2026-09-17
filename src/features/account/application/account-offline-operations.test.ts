import { describe, expect, it } from 'vitest'

import {
  createAddOrderItemOperation,
  createRemoveOrderItemOperation,
  createUpdateOrderItemOperation,
} from './account-offline-operations'

describe('account offline operations', () => {
  it('uses the command id as a stable retry identity', () => {
    const operation = createAddOrderItemOperation({
      menuItemId: 'menu-item',
      operationId: 'command-123',
      quantity: 2,
      sessionId: 'session',
      tenantId: 'tenant',
      venueId: 'venue',
    })

    expect(operation.id).toBe('add-order-item:command-123')
    expect(operation.payload.operationId).toBe('command-123')
  })

  it('creates stable identities for quantity changes and removals', () => {
    const update = createUpdateOrderItemOperation('change-123', {
      notes: null,
      orderItemId: 'order-item',
      quantity: 3,
      sessionId: 'session',
      tenantId: 'tenant',
      venueId: 'venue',
    })
    const remove = createRemoveOrderItemOperation('remove-123', {
      orderItemId: 'order-item',
      reason: 'Quitado en el TPV',
      sessionId: 'session',
      tenantId: 'tenant',
      venueId: 'venue',
    })

    expect(update.id).toBe('update-order-item:change-123')
    expect(remove.id).toBe('remove-order-item:remove-123')
  })
})
