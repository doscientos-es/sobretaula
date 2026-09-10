import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'

import type { InvoiceSeries } from '@/features/invoices'
import type { MenuCatalog } from '@/features/menu'
import type { Locale } from '@/shared/lib/i18n/locale'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import type { AccountView } from '../application/account'
import { AccountIssueInvoice } from './account-issue-invoice'
import { AccountOrderWorkspace } from './account-order-workspace'
import { AccountPayments } from './account-payments'

/** Cuenta de una sesión de mesa: consumiciones a la izquierda, cobro a la derecha. */
export function AccountPage({
  account,
  canManageAdjustments,
  invoiceSeries,
  locale,
  menu,
  tenantId,
  venueId,
}: {
  account: AccountView
  canManageAdjustments: boolean
  invoiceSeries: InvoiceSeries[]
  locale: Locale
  menu: MenuCatalog
  tenantId: string
  venueId: string
}) {
  const { session } = account
  const open = session.status === 'open'
  const openedAt = new Date(session.openedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const tablesLabel =
    session.tableCodes.length > 0 ? ` · Mesa ${session.tableCodes.join(' + ')}` : ''
  const reload = useLoaderReload()

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{`Cuenta${tablesLabel}`}</PageHeaderTitle>
          <PageHeaderDescription>
            {`${session.covers} comensales · abierta a las ${openedAt}${open ? '' : ' · cerrada'}`}
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <AccountOrderWorkspace
            account={account}
            locale={locale}
            menu={menu}
            tenantId={tenantId}
            venueId={venueId}
          />
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <AccountPayments
            account={account}
            canManageAdjustments={canManageAdjustments}
            locale={locale}
            onDone={reload}
            tenantId={tenantId}
            venueId={venueId}
          />
          {!open && invoiceSeries.length > 0 && (
            <AccountIssueInvoice
              disabled={false}
              locale={locale}
              sessionId={session.id}
              series={invoiceSeries}
              tenantId={tenantId}
              venueId={venueId}
            />
          )}
          {!open && invoiceSeries.length === 0 && (
            <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
              Para emitir la factura, crea primero una serie en Facturación.
            </p>
          )}
        </aside>
      </div>
    </section>
  )
}
