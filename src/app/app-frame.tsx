import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CalendarDays, FileText, LayoutDashboard, Map, Settings2, Utensils } from 'lucide-react'
import type { ReactNode } from 'react'

import { LogoutButton } from '@/features/auth'
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
      <AppShellSidebar className="hidden p-5 md:block">
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-2 text-base font-semibold tracking-tight"
        >
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-xl">
            <Utensils className="size-4" />
          </span>
          {t('app.name')}
        </Link>
        <p className="text-muted-foreground mt-8 px-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
          Operativa
        </p>
        <nav aria-label="Principal" className="mt-3 space-y-1">
          <Link
            to="/t/$slug"
            params={{ slug }}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'bg-secondary text-foreground shadow-sm' }}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="size-4" />
            Resumen
          </Link>
          <Link
            to="/t/$slug/plano"
            params={{ slug }}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'bg-muted text-foreground' }}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <Map className="size-4" />
            {t('nav.floorPlan')}
          </Link>
          <Link
            to="/t/$slug/reservas"
            params={{ slug }}
            activeProps={{ className: 'bg-muted text-foreground' }}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <CalendarDays className="size-4" />
            {t('nav.reservations')}
          </Link>
          <Link
            to="/t/$slug/facturas"
            params={{ slug }}
            activeProps={{ className: 'bg-muted text-foreground' }}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <FileText className="size-4" />
            {t('nav.invoices')}
          </Link>
        </nav>
        <p className="text-muted-foreground mt-8 px-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
          Espacio
        </p>
        <nav className="mt-3">
          <Link
            to="/t/$slug/facturas"
            params={{ slug }}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <Settings2 className="size-4" />
            {t('nav.settings')}
          </Link>
        </nav>
      </AppShellSidebar>
      <AppShellMain className="min-w-0 flex-1">
        <AppShellHeader className="flex h-16 items-center justify-between px-5 sm:px-8">
          <span className="text-muted-foreground text-sm font-medium">{title}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs">{t('invoices.env.test')}</span>
            <LogoutButton />
          </div>
        </AppShellHeader>
        <AppShellContent className="mx-auto max-w-7xl p-5 sm:p-8">{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}
