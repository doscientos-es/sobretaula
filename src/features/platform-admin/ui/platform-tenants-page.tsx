import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import type { PlatformDashboardTenant } from '../application/platform-dashboard'
import {
  filterPlatformTenants,
  type TenantDirectoryOrder,
  type TenantDirectoryStatus,
  type TenantDirectorySubscription,
} from '../domain/platform-tenant-directory'

const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })

function tenantStatusLabel(status: PlatformDashboardTenant['status']): string {
  return {
    active: 'Activo',
    setup_pending: 'Configuración pendiente',
    suspended: 'Suspendido',
    trial: 'Prueba',
  }[status]
}

function subscriptionStatusLabel(
  status: NonNullable<PlatformDashboardTenant['subscription']>['status'],
): string {
  return { active: 'Activa', canceled: 'Cancelada', past_due: 'Impago', trialing: 'Primer año' }[
    status
  ]
}

/** Searchable directory of every tenant; mutations deliberately live on its detail page. */
export function PlatformTenantsPage({ tenants }: { tenants: PlatformDashboardTenant[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TenantDirectoryStatus>('all')
  const [subscription, setSubscription] = useState<TenantDirectorySubscription>('all')
  const [order, setOrder] = useState<TenantDirectoryOrder>('newest')
  const visibleTenants = useMemo(
    () => filterPlatformTenants(tenants, { order, query, status, subscription }),
    [order, query, status, subscription, tenants],
  )

  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Tenants</PageHeaderTitle>
          <PageHeaderDescription>
            Directorio completo de restaurantes. Las modificaciones se realizan desde la ficha de
            cada tenant.
          </PageHeaderDescription>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Buscar y filtrar</CardTitle>
          <CardDescription>
            Mostrando {visibleTenants.length} de {tenants.length} tenants.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            aria-label="Buscar tenant"
            className="xl:col-span-1"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o slug…"
            value={query}
          />
          <select
            aria-label="Filtrar por estado"
            className="border-input h-10 rounded-md border bg-transparent px-3 text-sm"
            onChange={(event) => setStatus(event.target.value as TenantDirectoryStatus)}
            value={status}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="trial">Prueba</option>
            <option value="setup_pending">Configuración pendiente</option>
            <option value="suspended">Suspendido</option>
          </select>
          <select
            aria-label="Filtrar por suscripción"
            className="border-input h-10 rounded-md border bg-transparent px-3 text-sm"
            onChange={(event) =>
              setSubscription(
                event.target.value === 'none'
                  ? null
                  : (event.target.value as TenantDirectorySubscription),
              )
            }
            value={subscription ?? 'none'}
          >
            <option value="all">Todas las suscripciones</option>
            <option value="active">Activa</option>
            <option value="trialing">Primer año</option>
            <option value="past_due">Impago</option>
            <option value="canceled">Cancelada</option>
            <option value="none">Sin suscripción</option>
          </select>
          <select
            aria-label="Ordenar tenants"
            className="border-input h-10 rounded-md border bg-transparent px-3 text-sm"
            onChange={(event) => setOrder(event.target.value as TenantDirectoryOrder)}
            value={order}
          >
            <option value="newest">Más recientes primero</option>
            <option value="oldest">Más antiguos primero</option>
            <option value="name_asc">Nombre: A a Z</option>
            <option value="name_desc">Nombre: Z a A</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todos los tenants</CardTitle>
          <CardDescription>
            Consulta el estado y abre la ficha para revisar o configurar un tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="px-5 py-3 font-medium">Restaurante</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium">Suscripción</th>
                <th className="px-3 py-3 font-medium">Próximo cobro</th>
                <th className="px-3 py-3 font-medium">Alta</th>
                <th className="px-3 py-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {visibleTenants.map((tenant) => (
                <tr className="border-b last:border-0" key={tenant.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{tenant.slug}</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className="bg-muted rounded-full px-2 py-1 text-xs">
                      {tenantStatusLabel(tenant.status)}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    {tenant.subscription
                      ? `${tenant.subscription.planName} · ${subscriptionStatusLabel(tenant.subscription.status)}`
                      : 'Sin suscripción'}
                  </td>
                  <td className="px-3 py-4">
                    {tenant.subscription?.nextPaymentOn ?? 'Sin programar'}
                  </td>
                  <td className="px-3 py-4">{date.format(new Date(tenant.createdAt))}</td>
                  <td className="px-3 py-4">
                    <Link
                      className="text-primary whitespace-nowrap underline"
                      params={{ tenantId: tenant.id }}
                      to="/admin/tenants/$tenantId"
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
              {visibleTenants.length === 0 && (
                <tr>
                  <td className="text-muted-foreground px-5 py-8 text-center" colSpan={6}>
                    No hay tenants que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  )
}
