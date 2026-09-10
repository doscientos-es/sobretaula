import type { MenuCatalog } from '@/features/menu'
import type { Locale } from '@/shared/lib/i18n/locale'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import type { AccountView } from '../application/account'
import { AccountAddItem } from './account-add-item'
import { AccountLines } from './account-lines'

/** Reusable order-taking workspace for both the legacy account and the TPV terminal. */
export function AccountOrderWorkspace({
  account,
  locale,
  menu,
  tenantId,
  venueId,
}: {
  account: AccountView
  locale: Locale
  menu: MenuCatalog
  tenantId: string
  venueId: string
}) {
  const reload = useLoaderReload()
  const { session } = account
  const open = session.status === 'open'

  return (
    <div className="space-y-6">
      <AccountLines
        canEdit={open && account.payments.length === 0}
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
  )
}
