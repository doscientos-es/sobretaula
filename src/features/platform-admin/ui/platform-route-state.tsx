import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CircleAlert, RefreshCw } from 'lucide-react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export function platformRouteErrorCopy(error: unknown) {
  if (error instanceof Response && error.status === 403) {
    return {
      description: 'Tu cuenta no tiene permisos para acceder a esta sección de plataforma.',
      title: 'Acceso no autorizado',
    }
  }
  if (error instanceof Response && error.status === 404) {
    return {
      description: 'El recurso solicitado ya no existe o no está disponible.',
      title: 'No hemos encontrado esta información',
    }
  }
  return {
    description: 'Comprueba tu conexión e inténtalo de nuevo. Si continúa, contacta con soporte.',
    title: 'No se ha podido cargar esta sección',
  }
}

/** Stable loading surface for protected platform routes. */
export function PlatformRoutePending() {
  return (
    <main aria-busy="true" aria-live="polite" className="st-platform-page space-y-6">
      <span className="sr-only">Cargando información de plataforma…</span>
      <div className="border-border/70 animate-pulse space-y-3 border-b pb-6">
        <div className="bg-muted h-6 w-56 rounded" />
        <div className="bg-muted h-4 w-full max-w-xl rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div className="bg-muted h-28 animate-pulse rounded-xl" key={index} />
        ))}
      </div>
      <div className="bg-muted h-72 animate-pulse rounded-xl" />
    </main>
  )
}

/** Route boundary that keeps the platform shell usable after a loader failure. */
export function PlatformRouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const reload = useLoaderReload()
  const copy = platformRouteErrorCopy(error)

  function retry() {
    reset()
    reload()
  }

  return (
    <main aria-live="assertive" className="st-platform-page">
      <Card className="mx-auto mt-10 max-w-xl">
        <CardHeader>
          <CircleAlert aria-hidden="true" className="text-destructive size-6" />
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onPress={retry} type="button">
            <RefreshCw aria-hidden="true" className="size-4" /> Reintentar
          </Button>
          <Link className="text-sm underline underline-offset-4" to="/admin">
            Volver al resumen
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
