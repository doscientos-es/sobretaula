import type { ReactNode } from 'react'

import type { MenuCatalog } from '@/features/menu'
import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney } from '@/shared/lib/money/money'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import type { AccountView } from '../application/account'
import { AccountAddItem } from './account-add-item'
import { AccountLines } from './account-lines'

/** Reusable order-taking workspace for both the legacy account and the TPV terminal. */
export function AccountOrderWorkspace({
  account,
  locale,
  menu,
  layout = 'stacked',
  paymentSummary,
  tenantId,
  venueId,
}: {
  account: AccountView
  layout?: 'pos' | 'stacked'
  locale: Locale
  menu: MenuCatalog
  paymentSummary?: ReactNode
  tenantId: string
  venueId: string
}) {
  const reload = useLoaderReload()
  const { session } = account
  const open = session.status === 'open'

  const lines = (
    <AccountLines
      canEdit={open && account.payments.length === 0}
      canRemove={open && account.payments.length === 0}
      lines={account.lines}
      compact={layout === 'pos'}
      locale={locale}
      onDone={() => void reload()}
      sessionId={session.id}
      tenantId={tenantId}
      venueId={venueId}
    />
  )
  const addItem = open && (
    <AccountAddItem
      locale={locale}
      menu={menu}
      onDone={() => void reload()}
      quickAdd={layout === 'pos'}
      sessionId={session.id}
      tenantId={tenantId}
      venueId={venueId}
    />
  )

  if (layout === 'pos') {
    return (
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="min-w-0 space-y-4">
          {lines}
          {paymentSummary ?? (
            <div className="bg-surface-subtle rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">Total de la cuenta</span>
                <span className="text-xl font-semibold tabular-nums">
                  {formatMoney(account.totals.grossCents, locale)}
                </span>
              </div>
              <div className="text-muted-foreground mt-1 flex items-center justify-between gap-4 text-sm">
                <span>Pendiente</span>
                <span className="tabular-nums">
                  {formatMoney(account.totals.balanceCents, locale)}
                </span>
              </div>
            </div>
          )}
        </div>
        {addItem}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {lines}
      {addItem}
    </div>
  )
}
