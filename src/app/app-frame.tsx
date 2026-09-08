import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

export function AppFrame({
  children,
  locale,
  slug,
  title,
}: {
  children: ReactNode
  locale: Locale
  slug: string
  title: string
}) {
  const t = createTranslator(locale)

  return (
    <AppShell className="flex min-h-svh">
      <AppShellSidebar className="hidden p-4 md:block">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          {t('app.name')}
        </Link>
        <nav aria-label="Principal" className="mt-8 space-y-1">
          <Link
            to="/t/$slug"
            params={{ slug }}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'bg-muted text-foreground' }}
            className="text-muted-foreground hover:bg-muted block rounded-md px-3 py-2 text-sm"
          >
            {t('nav.floorPlan')}
          </Link>
          <Link
            to="/t/$slug/facturas"
            params={{ slug }}
            activeProps={{ className: 'bg-muted text-foreground' }}
            className="text-muted-foreground hover:bg-muted block rounded-md px-3 py-2 text-sm"
          >
            {t('nav.invoices')}
          </Link>
        </nav>
      </AppShellSidebar>
      <AppShellMain className="min-w-0 flex-1">
        <AppShellHeader className="flex h-14 items-center justify-between px-4">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{t('invoices.env.test')}</span>
        </AppShellHeader>
        <AppShellContent className="mx-auto max-w-6xl p-4 sm:p-6">{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}
