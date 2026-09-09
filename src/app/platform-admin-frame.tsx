import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
  Badge,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CreditCard, FileText, LayoutDashboard, Settings2, ShieldCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'

import { LogoutButton } from '@/features/auth'

const navLinkClass =
  'st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors'

export function PlatformAdminFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell className="st-app-frame st-platform-frame" sidebarBreakpoint="lg">
      <AppShellSidebar className="hidden w-72 p-5 lg:block">
        <Link
          activeOptions={{ exact: true }}
          className="st-sidebar-brand flex items-center gap-3 px-2 py-2 text-base font-semibold tracking-tight"
          to="/admin"
        >
          <span className="st-brand-mark">
            <ShieldCheck className="size-[1.15rem]" />
          </span>
          <span>SobreTaula</span>
        </Link>
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-white/55 uppercase">
            Doscientos
          </p>
          <p className="mt-1 text-sm font-semibold">Control de plataforma</p>
        </div>
        <p className="st-sidebar-section mt-8 px-2 text-xs font-semibold tracking-[0.14em] uppercase">
          Operación
        </p>
        <nav aria-label="Navegación de plataforma" className="mt-3 space-y-1">
          <Link
            activeOptions={{ exact: true }}
            activeProps={{ className: `${navLinkClass} st-nav-link--active` }}
            className={navLinkClass}
            to="/admin"
          >
            <LayoutDashboard className="size-4" /> Resumen
          </Link>
          <Link
            activeProps={{ className: `${navLinkClass} st-nav-link--active` }}
            className={navLinkClass}
            to="/admin/facturacion"
          >
            <CreditCard className="size-4" /> Suscripciones
          </Link>
          <Link
            activeProps={{ className: `${navLinkClass} st-nav-link--active` }}
            className={navLinkClass}
            to="/admin/facturas"
          >
            <FileText className="size-4" /> Facturas fiscales
          </Link>
          <Link
            activeProps={{ className: `${navLinkClass} st-nav-link--active` }}
            className={navLinkClass}
            to="/admin/equipo"
          >
            <Users className="size-4" /> Equipo
          </Link>
        </nav>
        <p className="st-sidebar-section mt-8 px-2 text-xs font-semibold tracking-[0.14em] uppercase">
          Configuración
        </p>
        <nav className="mt-3">
          <Link
            activeProps={{ className: `${navLinkClass} st-nav-link--active` }}
            className={navLinkClass}
            to="/admin/ajustes"
          >
            <Settings2 className="size-4" /> Ajustes fiscales
          </Link>
        </nav>
      </AppShellSidebar>
      <AppShellMain className="bg-muted/20 min-w-0 flex-1">
        <AppShellHeader className="flex h-[4.5rem] items-center justify-between px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="st-brand-mark lg:hidden">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate text-xs font-medium">
                Doscientos · SobreTaula
              </p>
              <p className="truncate text-sm font-semibold tracking-[-0.02em]">
                Superadministración
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Badge className="hidden sm:inline-flex" variant="info">
              Entorno de gestión
            </Badge>
            <LogoutButton />
          </div>
        </AppShellHeader>
        <nav
          aria-label="Navegación de plataforma"
          className="st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-sm font-medium lg:hidden"
        >
          <Link activeOptions={{ exact: true }} to="/admin">
            Resumen
          </Link>
          <Link to="/admin/facturacion">Suscripciones</Link>
          <Link to="/admin/facturas">Facturas</Link>
          <Link to="/admin/equipo">Equipo</Link>
          <Link to="/admin/ajustes">Ajustes</Link>
        </nav>
        <AppShellContent className="min-w-0">{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}
