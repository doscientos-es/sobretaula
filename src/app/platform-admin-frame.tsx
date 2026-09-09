import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import {
  ChevronUp,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { LogoutButton } from '@/features/auth'
import { createBrowserSupabaseClient } from '@/shared/lib/supabase/client'

const navLinkClass =
  'st-platform-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

type PlatformUser = { displayName: string; email: string }

export function PlatformAdminFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell className="st-app-frame st-platform-frame" sidebarBreakpoint="lg">
      <AppShellSidebar className="st-platform-sidebar hidden w-56 flex-col p-3 lg:flex">
        <div className="min-h-0 flex-1">
          <Link
            activeOptions={{ exact: true }}
            className="st-platform-brand flex items-center gap-2 px-1.5 py-1.5 text-sm font-semibold tracking-tight"
            to="/admin"
          >
            <span className="st-platform-brand-mark">
              <ShieldCheck className="size-3.5" />
            </span>
            <span>SobreTaula</span>
          </Link>
         
          <nav aria-label="Navegación de plataforma" className="mt-3 space-y-0.5">
            <Link
              activeOptions={{ exact: true }}
              activeProps={{ className: `${navLinkClass} st-platform-nav-link--active` }}
              className={navLinkClass}
              to="/admin"
            >
              <LayoutDashboard className="size-3" /> Resumen
            </Link>
            <Link
              activeProps={{ className: `${navLinkClass} st-platform-nav-link--active` }}
              className={navLinkClass}
              to="/admin/facturacion"
            >
              <CreditCard className="size-3" /> Suscripciones
            </Link>
            <Link
              activeProps={{ className: `${navLinkClass} st-platform-nav-link--active` }}
              className={navLinkClass}
              to="/admin/facturas"
            >
              <FileText className="size-3" /> Facturas fiscales
            </Link>
          </nav>
          <div className="st-platform-nav-group mt-5 pt-4">
            <p className="st-platform-section-label px-1.5">Administración</p>
            <nav className="mt-2 space-y-0.5">
              <Link
                activeProps={{ className: `${navLinkClass} st-platform-nav-link--active` }}
                className={navLinkClass}
                to="/admin/equipo"
              >
                <Users className="size-3" /> Equipo
              </Link>
            </nav>
          </div>
          <div className="st-platform-nav-group mt-5 pt-4">
            <p className="st-platform-section-label px-1.5">Configuración</p>
            <nav className="mt-2">
              <Link
                activeProps={{ className: `${navLinkClass} st-platform-nav-link--active` }}
                className={navLinkClass}
                to="/admin/ajustes"
              >
                <Settings2 className="size-3" /> Ajustes fiscales
              </Link>
            </nav>
          </div>
        </div>
        <PlatformUserMenu />
      </AppShellSidebar>
      <AppShellMain className="st-platform-main min-w-0 flex-1">
        <AppShellHeader className="st-platform-header flex h-11 items-center justify-between px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="st-platform-brand-mark lg:hidden">
              <ShieldCheck className="size-3" />
            </span>
            <p className="st-platform-breadcrumb truncate text-xs">
              Superadministración
            </p>
          </div>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </AppShellHeader>
        <nav
          aria-label="Navegación de plataforma"
          className="st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-xs font-medium lg:hidden"
        >
          <Link activeOptions={{ exact: true }} to="/admin">
            Resumen
          </Link>
          <Link to="/admin/facturacion">Suscripciones</Link>
          <Link to="/admin/facturas">Facturas</Link>
          <Link to="/admin/equipo">Equipo</Link>
          <Link to="/admin/ajustes">Ajustes</Link>
        </nav>
        <AppShellContent className="st-platform-content min-w-0">{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}

function PlatformUserMenu() {
  const [user, setUser] = useState<PlatformUser | null>(null)

  useEffect(() => {
    void createBrowserSupabaseClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user?.email) return
        const displayName = data.user.user_metadata?.display_name
        setUser({
          displayName: typeof displayName === 'string' ? displayName : 'Cuenta de plataforma',
          email: data.user.email,
        })
      })
      .catch(() => undefined)
  }, [])

  const displayName = user?.displayName ?? 'Cuenta de plataforma'
  const email = user?.email ?? 'Sesión activa'

  return (
    <div className="st-platform-user-menu pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            aria-label={`Abrir menú de ${displayName}`}
            className="st-platform-user-trigger w-full justify-start gap-2 px-1.5"
            variant="ghost"
          >
            <Avatar className="st-platform-user-avatar" size="sm">
              <AvatarFallback aria-hidden="true" />
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-medium">{displayName}</span>
              <span className="text-muted-foreground block truncate text-[0.625rem]">{email}</span>
            </span>
            <ChevronUp aria-hidden="true" className="text-muted-foreground size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" offset={8} placement="top start">
          <DropdownMenuLabel>
            <span className="block text-xs font-medium">{displayName}</span>
            <span className="text-muted-foreground block text-xs font-normal">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-1 py-1">
            <LogoutButton />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
