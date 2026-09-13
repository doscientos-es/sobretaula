import { describe, expect, it } from 'vitest'

import { parsePurchaseDocumentExtraction } from './purchase-document-extraction'
describe('purchase document extraction', () => {
  it('normalizes valid extraction and requires review', () => {
    const result = parsePurchaseDocumentExtraction({
      lines: [
        { description: 'Tomate', quantity: 4, unit: 'kg', unitCostCents: 230, confidence: 0.92 },
      ],
    })
    expect(result.lines[0]?.description).toBe('Tomate')
    expect(result.reviewStatus).toBe('needs_review')
  })
  it('rejects malformed or untrusted output', () => {
    expect(() =>
      parsePurchaseDocumentExtraction({
        lines: [{ description: 'Tomate', quantity: 0, unitCostCents: 2, confidence: 2 }],
      }),
    ).toThrow('purchase_document_line_invalid')
    expect(() => parsePurchaseDocumentExtraction('not-json')).toThrow(
      'purchase_document_invalid_json',
    )
  })
})
