import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'

import { AppFrame } from '@/app/app-frame'
import { isTenantOperational, tenantBySlugQuery } from '@/features/tenancy'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { parseTenantSlug } from '@/shared/lib/tenant/tenant-slug'

export const Route = createFileRoute('/t/$slug')({
  loader: async ({ context, params }) => {
    const slug = parseTenantSlug(params.slug)
    if (!slug) throw notFound()

    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(slug))
    if (!tenant) throw notFound()

    return { tenant }
  },
  component: TenantLayout,
  notFoundComponent: TenantNotFound,
})

function TenantLayout() {
  const { tenant } = Route.useLoaderData()
  const t = createTranslator(tenant.defaultLocale)

  if (!isTenantOperational(tenant.status)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <DataViewState>
          <DataViewStateTitle>{tenant.name}</DataViewStateTitle>
          <DataViewStateDescription>{t('error.description')}</DataViewStateDescription>
        </DataViewState>
      </main>
    )
  }

  return (
    <AppFrame locale={tenant.defaultLocale} slug={tenant.slug} title={tenant.name}>
      <Outlet />
    </AppFrame>
  )
}

function TenantNotFound() {
  const t = createTranslator('es')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <DataViewState>
        <DataViewStateTitle>{t('tenant.notFound.title')}</DataViewStateTitle>
        <DataViewStateDescription>{t('tenant.notFound.description')}</DataViewStateDescription>
      </DataViewState>
    </main>
  )
}
