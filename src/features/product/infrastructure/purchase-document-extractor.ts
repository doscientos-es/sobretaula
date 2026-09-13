import {
  parsePurchaseDocumentExtraction,
  type ExtractedPurchaseDocument,
} from '../domain/purchase-document-extraction'
export interface PurchaseDocumentExtractor {
  extract(input: {
    contentType: string
    bytes: Uint8Array
    fileName: string
  }): Promise<ExtractedPurchaseDocument>
}
export class UnconfiguredPurchaseDocumentExtractor implements PurchaseDocumentExtractor {
  async extract(): Promise<ExtractedPurchaseDocument> {
    throw new Error('purchase_document_extractor_not_configured')
  }
}
export function validateProviderExtraction(value: unknown): ExtractedPurchaseDocument {
  return parsePurchaseDocumentExtraction(value)
}
