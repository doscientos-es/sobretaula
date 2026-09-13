export type PurchaseDocumentReviewStatus = 'needs_review' | 'approved' | 'rejected'
export interface ExtractedPurchaseLine {
  description: string
  quantity: number
  unit: string
  unitCostCents: number
  confidence: number
}
export interface ExtractedPurchaseDocument {
  supplierName: string | null
  documentNumber: string | null
  documentDate: string | null
  totalCents: number | null
  lines: ExtractedPurchaseLine[]
  reviewStatus: PurchaseDocumentReviewStatus
}
export function parsePurchaseDocumentExtraction(value: unknown): ExtractedPurchaseDocument {
  if (!value || typeof value !== 'object') throw new Error('purchase_document_invalid_json')
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.lines)) throw new Error('purchase_document_lines_required')
  const lines = input.lines.map((line) => {
    if (!line || typeof line !== 'object') throw new Error('purchase_document_line_invalid')
    const item = line as Record<string, unknown>
    const quantity = Number(item.quantity)
    const unitCostCents = Number(item.unitCostCents)
    const confidence = Number(item.confidence)
    if (
      typeof item.description !== 'string' ||
      !item.description.trim() ||
      quantity <= 0 ||
      unitCostCents < 0 ||
      confidence < 0 ||
      confidence > 1
    )
      throw new Error('purchase_document_line_invalid')
    return {
      description: item.description.trim(),
      quantity,
      unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'ud',
      unitCostCents,
      confidence,
    }
  })
  return {
    supplierName: typeof input.supplierName === 'string' ? input.supplierName.trim() || null : null,
    documentNumber:
      typeof input.documentNumber === 'string' ? input.documentNumber.trim() || null : null,
    documentDate: typeof input.documentDate === 'string' ? input.documentDate.trim() || null : null,
    totalCents: input.totalCents == null ? null : Number(input.totalCents),
    lines,
    reviewStatus: 'needs_review',
  }
}
