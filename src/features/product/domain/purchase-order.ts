export type PurchaseOrderStatus = 'draft' | 'approved' | 'sent' | 'received' | 'cancelled'

const transitions: Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['sent', 'cancelled'],
  sent: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

export function canAdvancePurchaseOrder(
  current: PurchaseOrderStatus,
  next: PurchaseOrderStatus,
): boolean {
  return transitions[current].includes(next)
}

export interface PurchaseOrderLine {
  ingredientId: string
  quantity: number
  unitCostCents: number
}

export function validatePurchaseOrderLines(lines: readonly PurchaseOrderLine[]): string | null {
  if (!lines.length) return 'purchase_order_requires_lines'
  if (
    lines.some((line) => !line.ingredientId.trim() || line.quantity <= 0 || line.unitCostCents < 0)
  )
    return 'purchase_order_invalid_line'
  const ids = new Set(lines.map((line) => line.ingredientId))
  return ids.size === lines.length ? null : 'purchase_order_duplicate_ingredient'
}
