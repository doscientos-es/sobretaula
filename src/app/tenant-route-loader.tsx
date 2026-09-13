import { Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'

/** Stable loading surface shared by tenant routes during direct navigation. */
export function TenantRoutePending() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6"
    >
      <span className="sr-only">Cargando información del restaurante…</span>
      <div className="border-border/70 animate-pulse space-y-3 border-b pb-6">
        <div className="bg-muted h-7 w-56 rounded" />
        <div className="bg-muted h-4 w-full max-w-2xl rounded" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="bg-muted h-5 w-48 animate-pulse rounded text-transparent">
            Cargando
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-48 animate-pulse rounded-xl" />
        </CardContent>
      </Card>
    </main>
  )
}

export const tenantRouteState = {
  pendingComponent: TenantRoutePending,
  pendingMs: 200,
}