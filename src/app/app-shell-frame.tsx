import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from '@doscientos/ui'
import type { ReactNode } from 'react'

/** Shared structure for frames. Each area owns its own navigation and context. */
export function AppShellFrame({
  children,
  className,
  contentClassName,
  header,
  headerClassName,
  mainClassName,
  mobileNavigation,
  sidebar,
  sidebarClassName,
}: {
  children: ReactNode
  className: string
  contentClassName: string
  header: ReactNode
  headerClassName: string
  mainClassName: string
  mobileNavigation: ReactNode
  sidebar: ReactNode
  sidebarClassName: string
}) {
  return (
    <AppShell className={className} sidebarBreakpoint="lg">
      <AppShellSidebar className={sidebarClassName}>{sidebar}</AppShellSidebar>
      <AppShellMain className={mainClassName}>
        <AppShellHeader className={headerClassName}>{header}</AppShellHeader>
        {mobileNavigation}
        <AppShellContent className={contentClassName}>{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}
