import { useRouter } from '@tanstack/react-router'

/**
 * Recarga en sitio los loaders de la ruta activa: revalida el router y vuelve a
 * ejecutarlos. Evita `window.location.reload()`, que descarta la caché de
 * Query y repite el bootstrap completo del documento (lo que la puerta de
 * adopción de ADR-0001 exige evitar).
 */
export function useLoaderReload(): () => void {
  const router = useRouter()
  return () => {
    void router.invalidate().then(() => router.load())
  }
}
