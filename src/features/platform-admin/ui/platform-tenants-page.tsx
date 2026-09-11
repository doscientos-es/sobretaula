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
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { PlatformTenantProvisioningForm } from './platform-tenant-provisioning-form'

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

      <PlatformTenantProvisioningForm />

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
          <Select
            aria-label="Filtrar por estado"
            className="w-full"
            onSelectionChange={(key) => setStatus(String(key) as TenantDirectoryStatus)}
            selectedKey={status}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectList>
                <SelectItem id="all">Todos los estados</SelectItem>
                <SelectItem id="active">Activo</SelectItem>
                <SelectItem id="trial">Prueba</SelectItem>
                <SelectItem id="setup_pending">Configuración pendiente</SelectItem>
                <SelectItem id="suspended">Suspendido</SelectItem>
              </SelectList>
            </SelectContent>
          </Select>
          <Select
            aria-label="Filtrar por suscripción"
            className="w-full"
            onSelectionChange={(key) =>
              setSubscription(
                String(key) === 'none' ? null : (String(key) as TenantDirectorySubscription),
              )
            }
            selectedKey={subscription ?? 'none'}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectList>
                <SelectItem id="all">Todas las suscripciones</SelectItem>
                <SelectItem id="active">Activa</SelectItem>
                <SelectItem id="trialing">Primer año</SelectItem>
                <SelectItem id="past_due">Impago</SelectItem>
                <SelectItem id="canceled">Cancelada</SelectItem>
                <SelectItem id="none">Sin suscripción</SelectItem>
              </SelectList>
            </SelectContent>
          </Select>
          <Select
            aria-label="Ordenar tenants"
            className="w-full"
            onSelectionChange={(key) => setOrder(String(key) as TenantDirectoryOrder)}
            selectedKey={order}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectList>
                <SelectItem id="newest">Más recientes primero</SelectItem>
                <SelectItem id="oldest">Más antiguos primero</SelectItem>
                <SelectItem id="name_asc">Nombre: A a Z</SelectItem>
                <SelectItem id="name_desc">Nombre: Z a A</SelectItem>
              </SelectList>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todos los tenants</CardTitle>
          <CardDescription>
            Consulta el estado y abre la ficha para revisar o configurar un tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table className="min-w-[800px] text-left">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead className="px-5">Restaurante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead>Próximo cobro</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="px-5 py-4">
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{tenant.slug}</p>
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <span className="bg-muted rounded-full px-2 py-1 text-xs">
                      {tenantStatusLabel(tenant.status)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    {tenant.subscription
                      ? `${tenant.subscription.planName} · ${subscriptionStatusLabel(tenant.subscription.status)}`
                      : 'Sin suscripción'}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    {tenant.subscription?.nextPaymentOn ?? 'Sin programar'}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    {date.format(new Date(tenant.createdAt))}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Link
                      className="text-primary whitespace-nowrap underline"
                      params={{ tenantId: tenant.id }}
                      to="/admin/tenants/$tenantId"
                    >
                      Ver ficha
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {visibleTenants.length === 0 && (
                <TableRow>
                  <TableCell className="text-muted-foreground px-5 py-8 text-center" colSpan={6}>
                    No hay tenants que coincidan con los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
