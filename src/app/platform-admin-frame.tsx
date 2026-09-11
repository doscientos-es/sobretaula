import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@doscientos/ui'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Building2,
  CreditCard,
  EllipsisVertical,
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { type ReactNode } from 'react'

import { LogoutButton, useCurrentUser, useLogout, userInitials } from '@/features/auth'

import { AppShellFrame } from './app-shell-frame'

const navLinkClass =
  'st-platform-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

export function PlatformAdminFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isBillingModule = pathname === '/admin/facturacion' || pathname === '/admin/facturas'

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
      mobileTabs={
        isBillingModule ? (
          <nav
            aria-label="Navegación de facturación"
            className="st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-xs font-medium lg:hidden"
          >
            <Link to="/admin/facturacion">Suscripciones</Link>
            <Link to="/admin/facturas">Facturas</Link>
          </nav>
        ) : null
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
                  to="/admin/tenants"
                >
                  <Building2 className="size-3" /> Tenants
                </Link>
                <Link
                  activeProps={{ className: `${navLinkClass} st-platform-nav-link--active` }}
                  className={navLinkClass}
                  to="/admin/equipo"
                >
                  <Users className="size-3" /> Equipo
                </Link>
                <Link
                  activeProps={{ className: `${navLinkClass} st-platform-nav-link--active` }}
                  className={navLinkClass}
                  to="/admin/auditoria"
                >
                  <ScrollText className="size-3" /> Auditoría
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
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { pending: logoutPending, signOut } = useLogout()

  const displayName = user?.displayName || 'Usuario actual'
  const email = user?.email || 'Sin email disponible'

  return (
    <footer className="st-platform-user-menu mt-auto flex shrink-0 items-center gap-2 pt-3">
      <Avatar className="st-platform-user-avatar" size="sm">
        <AvatarFallback className="text-white">{userInitials(displayName)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{displayName}</span>
        <span className="text-muted-foreground block truncate text-[0.625rem]">{email}</span>
      </span>
      <DropdownMenu
        className="z-[60] w-52"
        offset={8}
        placement="top end"
        trigger={
          <Button aria-label="Opciones de cuenta" size="icon" variant="ghost">
            <EllipsisVertical aria-hidden="true" className="size-4" />
          </Button>
        }
      >
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
        <DropdownMenuItem
          isDisabled={logoutPending}
          onPress={() => void signOut()}
          textValue="Salir"
        >
          <LogOut className="size-3.5" /> Salir
        </DropdownMenuItem>
      </DropdownMenu>
    </footer>
  )
}
