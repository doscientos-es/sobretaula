export interface DeliveryNoteLineInput {
  ingredientId: string
  quantity: number
  unitCostCents: number
}

export function validateDeliveryNoteLines(lines: readonly DeliveryNoteLineInput[]) {
  if (lines.length === 0) throw new Error('delivery_note_requires_lines')
  const seen = new Set<string>()
  for (const line of lines) {
    if (seen.has(line.ingredientId)) throw new Error('delivery_note_duplicate_ingredient')
    if (!Number.isFinite(line.quantity) || line.quantity <= 0)
      throw new Error('delivery_note_invalid_quantity')
    if (!Number.isFinite(line.unitCostCents) || line.unitCostCents < 0)
      throw new Error('delivery_note_invalid_cost')
    seen.add(line.ingredientId)
  }
  return lines
}
