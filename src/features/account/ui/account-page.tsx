import { Button, PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'

import type { InvoiceSeries } from '@/features/invoices'
import type { MenuCatalog } from '@/features/menu'
import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney } from '@/shared/lib/money/money'
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
        <Button
          className="st-no-print"
          onClick={() => window.print()}
          type="button"
          variant="outline"
        >
          Reimprimir ticket
        </Button>
      </PageHeader>
      <div className="st-no-print grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
      <PrintableAccountReceipt account={account} locale={locale} />
    </section>
  )
}

function PrintableAccountReceipt({ account, locale }: { account: AccountView; locale: Locale }) {
  return (
    <div className="st-print-only space-y-4">
      <h1 className="text-2xl font-semibold">Cuenta</h1>
      <p className="text-sm">
        {account.session.tableCodes.length > 0
          ? `Mesa ${account.session.tableCodes.join(' + ')} · `
          : ''}
        {new Date(account.session.openedAt).toLocaleString(locale)}
      </p>
      <ul className="space-y-2 border-y py-4 text-sm">
        {account.lines
          .filter((line) => line.status !== 'cancelled')
          .map((line) => (
            <li className="flex justify-between gap-4" key={line.id}>
              <span>
                {line.quantity} × {line.name}
                {line.modifiers && line.modifiers.length > 0 && (
                  <span className="block text-xs">
                    {line.modifiers.map((modifier) => modifier.name).join(', ')}
                  </span>
                )}
              </span>
              <span className="tabular-nums">
                {formatMoney(
                  line.quantity *
                    (line.unitPriceCents +
                      (line.modifiers ?? []).reduce(
                        (sum, modifier) => sum + modifier.priceDeltaCents,
                        0,
                      )),
                  locale,
                )}
              </span>
            </li>
          ))}
      </ul>
      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd>{formatMoney(account.totals.grossCents, locale)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Pagado</dt>
          <dd>{formatMoney(account.totals.paidCents, locale)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Pendiente</dt>
          <dd>{formatMoney(account.totals.balanceCents, locale)}</dd>
        </div>
      </dl>
    </div>
  )
}
