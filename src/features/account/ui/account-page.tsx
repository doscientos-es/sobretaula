import { PageHeader, PageHeaderTitle } from '@doscientos/ui'

import type { InvoiceSeries } from '@/features/invoices'
import type { MenuCatalog } from '@/features/menu'
import type { Locale } from '@/shared/lib/i18n/locale'

import type { AccountView } from '../application/account'
import { AccountAddItem } from './account-add-item'
import { AccountIssueInvoice } from './account-issue-invoice'
import { AccountLines } from './account-lines'
import { AccountPayments } from './account-payments'

/** Cuenta de una sesión de mesa: consumiciones a la izquierda, cobro a la derecha. */
export function AccountPage({
  account,
  invoiceSeries,
  locale,
  menu,
  tenantId,
  venueId,
}: {
  account: AccountView
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
      <PageHeader>
        <PageHeaderTitle>{`Cuenta${tablesLabel}`}</PageHeaderTitle>
      </PageHeader>
      <p className="text-muted-foreground text-sm">
        {`${session.covers} comensales · abierta a las ${openedAt}${open ? '' : ' · cerrada'}`}
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <AccountLines
            canRemove={open && account.payments.length === 0}
            lines={account.lines}
            locale={locale}
            onDone={reload}
            sessionId={session.id}
            tenantId={tenantId}
            venueId={venueId}
          />
          {open && (
            <AccountAddItem
              locale={locale}
              menu={menu}
              onDone={reload}
              sessionId={session.id}
              tenantId={tenantId}
              venueId={venueId}
            />
          )}
        </div>
        <AccountPayments
          account={account}
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
          <p className="text-muted-foreground text-sm">
            Para emitir la factura, crea primero una serie en Facturación.
          </p>
        )}
      </div>
    </section>
  )
}
