import {
  Card,
  CardContent,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowRight, Building2, Utensils } from 'lucide-react'

import { AppShellFrame } from '@/app/app-shell-frame'
import { CurrentUserSidebar } from '@/features/auth'
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
    <AppShellFrame
      className="st-app-frame st-saas-frame"
      contentClassName="mx-auto max-w-5xl p-4 sm:p-6"
      header={
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="st-saas-brand-mark lg:hidden">
            <Utensils className="size-3" />
          </span>
          <p className="st-saas-breadcrumb truncate text-xs">Tus restaurantes</p>
        </div>
      }
      headerClassName="st-saas-header flex h-11 items-center justify-between px-5 sm:px-6"
      mainClassName="st-saas-main min-w-0 flex-1"
      mobileTabs={null}
      sidebar={
        <>
          <Link
            className="st-saas-brand flex items-center gap-2 px-1.5 py-1.5 text-sm font-semibold tracking-tight"
            to="/"
          >
            <span className="st-saas-brand-mark">
              <Utensils className="size-3.5" />
            </span>
            <span className="font-semibold tracking-[-0.03em]">SobreTaula</span>
          </Link>
          <CurrentUserSidebar />
        </>
      }
      sidebarClassName="st-saas-sidebar hidden w-56 p-3 lg:flex lg:h-svh lg:flex-col"
    >
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>
            {tenants.length === 0 ? 'Sin acceso a restaurantes' : 'Elige un restaurante'}
          </PageHeaderTitle>
          <PageHeaderDescription>
            {tenants.length === 0
              ? 'Crea y configura tu primer restaurante para empezar.'
              : 'Selecciona el restaurante que quieres gestionar.'}
          </PageHeaderDescription>
        </div>
      </PageHeader>

      {tenants.length === 0 && (
        <Card className="mt-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium">Aún no tienes ningún restaurante</p>
              <p className="text-muted-foreground text-sm">
                Configura tu primer restaurante para empezar a gestionar reservas y cobros.
              </p>
            </div>
            <Link
              className="bg-primary text-primary-foreground inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium shadow-sm"
              to="/onboarding"
            >
              Configurar mi restaurante <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {tenants.length > 1 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
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
    </AppShellFrame>
  )
}
