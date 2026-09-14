import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
  Button,
  Drawer,
} from '@doscientos/ui'
import { Menu } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

/** Shared structure for frames. Each area owns its own navigation and context. */
export function AppShellFrame({
  children,
  className,
  contentClassName,
  header,
  headerClassName,
  locale,
  mainClassName,
  mobileTabs,
  sidebar,
  sidebarClassName,
}: {
  children: ReactNode
  className: string
  contentClassName: string
  header: ReactNode
  headerClassName: string
  locale: Locale
  mainClassName: string
  mobileTabs: ReactNode
  sidebar: ReactNode
  sidebarClassName: string
}) {
  const effectiveLocale = useLocale(locale)
  const t = createTranslator(effectiveLocale)

  return (
    <>
      <a className="st-skip-link" href="#main-content">
        {t('common.skipToContent')}
      </a>
      <AppShell className={className} sidebarBreakpoint="lg">
        <AppShellSidebar className={sidebarClassName}>{sidebar}</AppShellSidebar>
        <AppShellMain className={mainClassName}>
          <AppShellHeader className={headerClassName}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Drawer
                className="w-[min(88vw,22rem)]"
                dialogProps={{ 'aria-label': t('common.navigationMenu') }}
                side="left"
                trigger={
                  <Button
                    aria-label={t('common.openNavigation')}
                    className="st-mobile-menu-trigger shrink-0 lg:hidden"
                    size="icon"
                    variant="ghost"
                  >
                    <Menu aria-hidden="true" className="size-4" />
                  </Button>
                }
              >
                <div className="st-mobile-drawer flex h-full min-h-0 flex-col overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  {sidebar}
                </div>
              </Drawer>
              {header}
            </div>
          </AppShellHeader>
          {mobileTabs}
          <AppShellContent className={contentClassName} id="main-content" tabIndex={-1}>
            {children}
          </AppShellContent>
        </AppShellMain>
      </AppShell>
    </>
  )
}
