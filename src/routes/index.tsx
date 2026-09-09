import {
  Card,
  CardContent,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
} from '@doscientos/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowRight, Building2, Utensils } from 'lucide-react'

import { getUserDestinations } from '@/features/tenancy'

export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const destinations = await getUserDestinations()
      if (destinations.isPlatformMember) throw redirect({ to: '/admin' })
      const [tenant] = destinations.tenants
      if (tenant && destinations.tenants.length === 1) {
        throw redirect({ to: '/t/$slug', params: { slug: tenant.slug } })
      }
      return destinations
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/' } })
      }
      throw error
    }
  },
  component: TenantPicker,
})

function TenantPicker() {
  const { tenants } = Route.useLoaderData()

  return (
    <main className="st-auth-shell">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <Card className="st-auth-card relative w-full max-w-xl">
        <CardContent className="py-2">
          <div className="st-brand-mark mb-6">
            <Utensils className="size-5" />
          </div>
          <DataViewState className="min-h-0 border-0 bg-transparent p-0 text-left shadow-none">
            <DataViewStateTitle>
              {tenants.length === 0 ? 'Sin acceso a restaurantes' : 'Elige un restaurante'}
            </DataViewStateTitle>
            <DataViewStateDescription>
              {tenants.length === 0
                ? 'Crea y configura tu primer restaurante para empezar.'
                : 'Selecciona el restaurante que quieres gestionar.'}
            </DataViewStateDescription>
            {tenants.length === 0 && (
              <Link
                className="bg-primary text-primary-foreground mt-6 inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-medium shadow-sm"
                to="/onboarding"
              >
                Configurar mi restaurante <ArrowRight className="size-4" />
              </Link>
            )}
            {tenants.length > 1 && (
              <ul className="mt-6 w-full space-y-2">
                {tenants.map((tenant) => (
                  <li key={tenant.slug}>
                    <Link
                      className="border-border/80 hover:border-primary/35 hover:bg-secondary bg-card flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium shadow-[var(--ui-shadow-hairline)] transition-colors"
                      params={{ slug: tenant.slug }}
                      to="/t/$slug"
                    >
                      <span className="flex items-center gap-3">
                        <Building2 className="text-primary size-4" />
                        {tenant.name}
                      </span>
                      <ArrowRight className="text-muted-foreground size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataViewState>
        </CardContent>
      </Card>
    </main>
  )
}
