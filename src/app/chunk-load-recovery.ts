const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? 'dev'
const RECOVERY_MARKER = 'sobretaula:chunk-load-recovery'
let recoveryInstalled = false

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk/i.test(
    message,
  )
}

/** Recovers once from a stale deployment asset without creating a reload loop. */
export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined' || recoveryInstalled) return
  recoveryInstalled = true

  const recover = () => {
    let alreadyRecovered = false
    try {
      alreadyRecovered = sessionStorage.getItem(RECOVERY_MARKER) === BUILD_ID
      if (!alreadyRecovered) sessionStorage.setItem(RECOVERY_MARKER, BUILD_ID)
    } catch {
      // Storage can be blocked; the reload is still safer than leaving the app unusable.
    }
    if (alreadyRecovered) return

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        void Promise.all(
          registrations.map((registration) => registration.update().catch(() => undefined)),
        )
      })
    }
    window.setTimeout(() => window.location.reload(), 250)
  }

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error ?? event.message)) recover()
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) recover()
  })
}
