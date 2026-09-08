import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'

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
    <main className="mx-auto max-w-2xl p-6">
      <DataViewState>
        <DataViewStateTitle>
          {tenants.length === 0 ? 'Sin acceso a restaurantes' : 'Elige un restaurante'}
        </DataViewStateTitle>
        <DataViewStateDescription>
          {tenants.length === 0
            ? 'Crea y configura tu primer restaurante para empezar.'
            : 'Selecciona el restaurante que quieres gestionar.'}
        </DataViewStateDescription>
        {tenants.length === 0 && (
          <Link className="text-primary mt-5 inline-block underline" to="/onboarding">
            Configurar mi restaurante
          </Link>
        )}
        {tenants.length > 1 && (
          <ul className="mt-5 space-y-2">
            {tenants.map((tenant) => (
              <li key={tenant.slug}>
                <Link
                  className="text-primary underline"
                  params={{ slug: tenant.slug }}
                  to="/t/$slug"
                >
                  {tenant.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DataViewState>
    </main>
  )
}
