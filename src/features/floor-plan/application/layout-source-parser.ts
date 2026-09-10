import type { LayoutTemplate } from '../domain/layout-template'

export type LayoutSourceKind = 'json' | 'image' | 'pdf'

export interface LayoutSource {
  kind: LayoutSourceKind
  name: string
  bytes: Uint8Array
  mimeType: string
}

export interface LayoutParseResult {
  confidence: number
  template?: LayoutTemplate
  needsReview: boolean
  notes: string[]
}

export interface LayoutSourceParser {
  supports(kind: LayoutSourceKind): boolean
  parse(source: LayoutSource): Promise<LayoutParseResult>
}

export function detectLayoutSourceKind(
  mimeType: string,
  name: string,
): LayoutSourceKind | undefined {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'application/json' || name.toLowerCase().endsWith('.json')) return 'json'
  if (normalized === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (normalized.startsWith('image/')) return 'image'
  return undefined
}

/** Makes unsupported OCR/vector extraction explicit instead of silently guessing. */
export class ManualReviewLayoutSourceParser implements LayoutSourceParser {
  constructor(private readonly kind: LayoutSourceKind) {}

  supports(kind: LayoutSourceKind): boolean {
    return kind === this.kind
  }

  async parse(source: LayoutSource): Promise<LayoutParseResult> {
    return {
      confidence: 0,
      needsReview: true,
      notes: [`La fuente ${source.name} requiere extracción asistida antes de publicar.`],
    }
  }
}
