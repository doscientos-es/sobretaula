import { useEffect } from 'react'

/** Runs an async synchronization after commit and ignores its promise. */
export function useAsyncEffect(
  effect: () => Promise<void> | void | (() => void),
  dependencies: readonly unknown[],
) {
  useEffect(() => {
    const cleanup = effect()
    if (typeof cleanup === 'function') return cleanup
    // The caller owns the stable callback and its dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
