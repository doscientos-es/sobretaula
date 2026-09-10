import { describe, expect, it } from 'vitest'

import {
  detectLayoutSourceKind,
  JsonLayoutSourceParser,
  ManualReviewLayoutSourceParser,
} from './layout-source-parser'

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

  it('parses JSON through the shared template validation', async () => {
    const result = await new JsonLayoutSourceParser().parse({
      kind: 'json',
      name: 'sala.json',
      bytes: new TextEncoder().encode(
        JSON.stringify({
          format: 'sobretaula-floor-plan-template',
          version: 1,
          widthCm: 100,
          heightCm: 100,
          tables: [],
          elements: [],
        }),
      ),
      mimeType: 'application/json',
    })
    expect(result).toMatchObject({ confidence: 1, needsReview: false })
    expect(result.template?.widthCm).toBe(100)
  })
})
