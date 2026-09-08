/** Immutable undo/redo history used by the floor-plan editor. */
export interface EditorHistory<T> {
  future: readonly T[]
  past: readonly T[]
  present: T
}

export function createEditorHistory<T>(present: T): EditorHistory<T> {
  return { future: [], past: [], present }
}

export function commitEditorHistory<T>(history: EditorHistory<T>, present: T): EditorHistory<T> {
  return { future: [], past: [...history.past, history.present], present }
}

export function redoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  const [present, ...future] = history.future
  return present === undefined
    ? history
    : { future, past: [...history.past, history.present], present }
}

export function undoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  const past = [...history.past]
  const present = past.pop()
  return present === undefined
    ? history
    : { future: [history.present, ...history.future], past, present }
}
