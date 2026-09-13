export interface OnlineOrderLine {
  menuItemId: string
  name: string
  quantity: number
  unitPriceCents: number
}
export function calculateOnlineOrderTotal(lines: readonly OnlineOrderLine[]): number {
  return lines.reduce(
    (total, line) => total + Math.round(line.quantity) * Math.round(line.unitPriceCents),
    0,
  )
}
export function validateOnlineOrderLines(lines: readonly OnlineOrderLine[]): string | null {
  if (!lines.length) return 'empty_order'
  if (
    lines.some(
      (line) =>
        !line.menuItemId.trim() ||
        !line.name.trim() ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        line.quantity > 99 ||
        !Number.isInteger(line.unitPriceCents) ||
        line.unitPriceCents < 0,
    )
  )
    return 'invalid_order_line'
  return null
}
