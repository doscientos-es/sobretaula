import { describe, expect, it } from 'vitest'

import { detectLayoutSourceKind, ManualReviewLayoutSourceParser } from './layout-source-parser'

describe('layout source parser boundary', () => {
  it('detects JSON, PDF and image sources by mime or extension', () => {
    expect(detectLayoutSourceKind('application/json', 'layout.txt')).toBe('json')
    expect(detectLayoutSourceKind('', 'layout.pdf')).toBe('pdf')
    expect(detectLayoutSourceKind('image/png', 'layout.bin')).toBe('image')
    expect(detectLayoutSourceKind('text/plain', 'layout.txt')).toBeUndefined()
  })

  it('never silently publishes an unparsed visual source', async () => {
    const result = await new ManualReviewLayoutSourceParser('pdf').parse({
      kind: 'pdf',
      name: 'sala.pdf',
      bytes: new Uint8Array(),
      mimeType: 'application/pdf',
    })
    expect(result).toMatchObject({ confidence: 0, needsReview: true })
    expect(result.template).toBeUndefined()
  })
})
