import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@doscientos/ui'
import { Link, useNavigate } from '@tanstack/react-router'
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

import { AppShellFrame } from './app-shell-frame'

const navLinkClass =
  'st-platform-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

type PlatformUser = { displayName: string; email: string }

export function PlatformAdminFrame({ children }: { children: ReactNode }) {
  return (
    <AppShellFrame
      className="st-app-frame st-platform-frame"
      contentClassName="st-platform-content min-w-0"
      header={
        <>
          <div className="flex min-w-0 items-center gap-3">
            <span className="st-platform-brand-mark lg:hidden">
              <ShieldCheck className="size-3" />
            </span>
            <p className="st-platform-breadcrumb truncate text-xs">Superadministración</p>
          </div>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </>
      }
      headerClassName="st-platform-header flex h-11 items-center justify-between px-5 sm:px-8"
      mainClassName="st-platform-main min-w-0 flex-1"
      mobileNavigation={
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
      }
      sidebar={
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
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
        </>
      }
      sidebarClassName="st-platform-sidebar sticky top-0 hidden h-svh w-56 shrink-0 flex-col overflow-hidden p-3 lg:flex"
    >
      {children}
    </AppShellFrame>
  )
}

function PlatformUserMenu() {
  const [user, setUser] = useState<PlatformUser | null>(null)
  const navigate = useNavigate()

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
    <div className="st-platform-user-menu mt-auto shrink-0 pt-3">
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
          <DropdownMenuItem
            onPress={() => void navigate({ to: '/admin/equipo' })}
            textValue="Equipo de plataforma"
          >
            <Users className="size-3.5" /> Equipo de plataforma
          </DropdownMenuItem>
          <DropdownMenuItem
            onPress={() => void navigate({ to: '/admin/ajustes' })}
            textValue="Ajustes fiscales"
          >
            <Settings2 className="size-3.5" /> Ajustes fiscales
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-1 py-1">
            <LogoutButton />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
