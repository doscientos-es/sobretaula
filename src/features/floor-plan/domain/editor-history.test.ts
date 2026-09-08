import { describe, expect, it } from 'vitest'

import {
  commitEditorHistory,
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
} from './editor-history'

describe('editor history', () => {
  it('undoes and redoes committed immutable states', () => {
    const initial = createEditorHistory({ x: 0 })
    const changed = commitEditorHistory(initial, { x: 25 })

    expect(undoEditorHistory(changed).present).toEqual({ x: 0 })
    expect(redoEditorHistory(undoEditorHistory(changed)).present).toEqual({ x: 25 })
  })

  it('clears the redo stack when making a new change', () => {
    const changed = commitEditorHistory(createEditorHistory(1), 2)
    const replaced = commitEditorHistory(undoEditorHistory(changed), 3)

    expect(replaced.future).toEqual([])
    expect(replaced.present).toBe(3)
  })
})
