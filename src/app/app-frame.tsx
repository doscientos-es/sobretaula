import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
  Badge,
} from '@doscientos/ui'
import { Link, useParams } from '@tanstack/react-router'
import {
  CalendarDays,
  ConciergeBell,
  FileText,
  LayoutDashboard,
  Map,
  Utensils,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { LogoutButton } from '@/features/auth'
import { resolveVenue, VenueSwitcher, type Venue } from '@/features/venues'
import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

export function AppFrame({
  children,
  locale,
  slug,
  title,
  venues,
}: {
  children: ReactNode
  locale: Locale
  slug: string
  title: string
  venues: readonly Venue[]
}) {
  const t = createTranslator(locale)
  const params = useParams({ strict: false })
  const activeVenue = resolveVenue(venues, params.venue ?? null)

  return (
    <AppShell className="st-app-frame" sidebarBreakpoint="lg">
      <AppShellSidebar className="hidden w-72 p-5 lg:block">
        <Link
          to="/"
          className="st-sidebar-brand flex items-center gap-3 px-2 py-2 text-base font-semibold tracking-tight"
        >
          <span className="st-brand-mark">
            <Utensils className="size-[1.15rem]" />
          </span>
          <span className="font-semibold tracking-[-0.03em]">{t('app.name')}</span>
        </Link>
        <p className="st-sidebar-section mt-8 px-2 text-sm font-medium">
          Operativa
        </p>
        <nav aria-label="Principal" className="mt-3 space-y-1">
          <Link
            to="/t/$slug"
            params={{ slug }}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'st-nav-link st-nav-link--active' }}
            className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="size-4" />
            Resumen
          </Link>
          {activeVenue && (
            <>
              <Link
                to="/t/$slug/l/$venue/plano"
                params={{ slug, venue: activeVenue.slug }}
                activeOptions={{ exact: true }}
                activeProps={{ className: 'st-nav-link st-nav-link--active' }}
                className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <Map className="size-4" />
                {t('nav.floorPlan')}
              </Link>
              <Link
                to="/t/$slug/l/$venue/servicio"
                params={{ slug, venue: activeVenue.slug }}
                activeProps={{ className: 'st-nav-link st-nav-link--active' }}
                className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <ConciergeBell className="size-4" />
                {t('nav.service')}
              </Link>
              <Link
                to="/t/$slug/l/$venue/reservas"
                params={{ slug, venue: activeVenue.slug }}
                activeProps={{ className: 'st-nav-link st-nav-link--active' }}
                className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <CalendarDays className="size-4" />
                {t('nav.reservations')}
              </Link>
            </>
          )}
          <Link
            to="/t/$slug/carta"
            params={{ slug }}
            activeProps={{ className: 'st-nav-link st-nav-link--active' }}
            className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <UtensilsCrossed className="size-4" />
            {t('nav.menu')}
          </Link>
          <Link
            to="/t/$slug/facturacion"
            params={{ slug }}
            activeProps={{ className: 'st-nav-link st-nav-link--active' }}
            className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <FileText className="size-4" />
            {t('nav.billing')}
          </Link>
          <Link
            to="/t/$slug/facturas"
            params={{ slug }}
            activeProps={{ className: 'st-nav-link st-nav-link--active' }}
            className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <FileText className="size-4" />
            {t('nav.invoices')}
          </Link>
          <Link
            to="/t/$slug/equipo"
            params={{ slug }}
            activeProps={{ className: 'st-nav-link st-nav-link--active' }}
            className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <Users className="size-4" />
            Equipo
          </Link>
        </nav>
        <VenueSwitcher
          activeVenueSlug={activeVenue?.slug ?? null}
          locale={locale}
          tenantSlug={slug}
          venues={venues}
        />
        <p className="st-sidebar-section mt-8 px-2 text-sm font-medium">
          Cuenta
        </p>
        <nav className="mt-3">
          <Link
            to="/t/$slug/suscripcion/facturas"
            params={{ slug }}
            className="st-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <FileText className="size-4" />
            Facturas de SobreTaula
          </Link>
        </nav>
      </AppShellSidebar>
      <AppShellMain className="min-w-0 flex-1">
        <AppShellHeader className="flex h-[4.5rem] items-center justify-between px-5 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="st-brand-mark lg:hidden">
              <Utensils className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate text-xs font-medium">{title}</p>
              <p className="truncate text-sm font-semibold tracking-[-0.02em]">
                {activeVenue?.name ?? 'Visión general'}
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Badge className="hidden sm:inline-flex" variant="info">
              {t('invoices.env.test')}
            </Badge>
            <LogoutButton />
          </div>
        </AppShellHeader>
        <nav
          aria-label="Navegación principal"
          className="st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-sm font-medium lg:hidden"
        >
          <Link params={{ slug }} to="/t/$slug">
            Resumen
          </Link>
          {activeVenue && (
            <Link params={{ slug, venue: activeVenue.slug }} to="/t/$slug/l/$venue/servicio">
              Servicio
            </Link>
          )}
          {activeVenue && (
            <Link params={{ slug, venue: activeVenue.slug }} to="/t/$slug/l/$venue/reservas">
              Reservas
            </Link>
          )}
          <Link params={{ slug }} to="/t/$slug/carta">
            Carta
          </Link>
          <Link params={{ slug }} to="/t/$slug/facturacion">
            Facturación
          </Link>
        </nav>
        <AppShellContent className="mx-auto max-w-7xl p-5 sm:p-8">{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}
