import { createFileRoute, redirect } from '@tanstack/react-router'

import { getPlatformBillingOverview, PlatformBillingOverview } from '@/features/platform-billing'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    try {
      return await getPlatformBillingOverview()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin' } })
      }
      throw error
    }
  },
  component: PlatformConsole,
})

function PlatformConsole() {
  const subscriptions = Route.useLoaderData()

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Consola de plataforma</h1>
        <p className="text-muted-foreground mt-1">
          Suscripciones SaaS, ciclo de cobro y estado operativo de los tenants.
        </p>
      </header>
      <PlatformBillingOverview subscriptions={subscriptions} />
    </main>
  )
}
