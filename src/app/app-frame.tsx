import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from '@doscientos/ui'
import { Link, useParams } from '@tanstack/react-router'
import {
  CalendarDays,
  ConciergeBell,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Map,
  Utensils,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { CurrentUserSidebar, LogoutButton } from '@/features/auth'
import { resolveVenue, VenueSwitcher, type Venue } from '@/features/venues'
import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

const navLinkClass =
  'st-saas-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

/** Tenant-management frame; shared shell structure lives in AppShellFrame. */
export function TenantAdminFrame({
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
    <AppShell className="st-app-frame st-saas-frame" sidebarBreakpoint="lg">
      <AppShellSidebar className="st-saas-sidebar hidden w-56 p-3 lg:flex lg:h-svh lg:flex-col">
        <Link
          to="/"
          className="st-saas-brand flex items-center gap-2 px-1.5 py-1.5 text-sm font-semibold tracking-tight"
        >
          <span className="st-saas-brand-mark">
            <Utensils className="size-3.5" />
          </span>
          <span className="font-semibold tracking-[-0.03em]">{t('app.name')}</span>
        </Link>
        <p className="st-saas-section-label mt-6 px-1.5">Espacio de trabajo</p>
        <nav aria-label="Principal" className="mt-3 space-y-0.5">
          <Link
            to="/t/$slug"
            params={{ slug }}
            activeOptions={{ exact: true }}
            activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
            className={navLinkClass}
          >
            <LayoutDashboard className="size-3" />
            Resumen
          </Link>
          {activeVenue && (
            <>
              <Link
                to="/t/$slug/l/$venue/plano"
                params={{ slug, venue: activeVenue.slug }}
                activeOptions={{ exact: true }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
              >
                <Map className="size-3" />
                {t('nav.floorPlan')}
              </Link>
              <Link
                to="/t/$slug/l/$venue/servicio"
                params={{ slug, venue: activeVenue.slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
              >
                <ConciergeBell className="size-3" />
                {t('nav.service')}
              </Link>
              <Link
                to="/t/$slug/l/$venue/reservas"
                params={{ slug, venue: activeVenue.slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
              >
                <CalendarDays className="size-3" />
                {t('nav.reservations')}
              </Link>
            </>
          )}
          <Link
            to="/t/$slug/carta"
            params={{ slug }}
            activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
            className={navLinkClass}
          >
            <UtensilsCrossed className="size-3" />
            {t('nav.menu')}
          </Link>
          <Link
            to="/t/$slug/facturacion"
            params={{ slug }}
            activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
            className={navLinkClass}
          >
            <FileText className="size-3" />
            {t('nav.billing')}
          </Link>
          <Link
            to="/t/$slug/facturas"
            params={{ slug }}
            activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
            className={navLinkClass}
          >
            <FileText className="size-3" />
            {t('nav.invoices')}
          </Link>
          <Link
            to="/t/$slug/equipo"
            params={{ slug }}
            activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
            className={navLinkClass}
          >
            <Users className="size-3" />
            Equipo
          </Link>
        </nav>
        <VenueSwitcher
          activeVenueSlug={activeVenue?.slug ?? null}
          locale={locale}
          tenantSlug={slug}
          venues={venues}
        />
        <div className="st-saas-nav-group mt-5 pt-4">
          <p className="st-saas-section-label px-1.5">Cuenta</p>
          <nav className="mt-2">
            <Link
              to="/t/$slug/suscripcion/facturas"
              params={{ slug }}
              activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
              className={navLinkClass}
            >
              <FileText className="size-3" />
              Facturas de SobreTaula
            </Link>
          </nav>
        </div>
        <CurrentUserSidebar />
      </AppShellSidebar>
      <AppShellMain className="st-saas-main min-w-0 flex-1">
        <AppShellHeader className="st-saas-header flex h-11 items-center justify-between px-5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="st-saas-brand-mark lg:hidden">
              <Utensils className="size-3" />
            </span>
            <p className="st-saas-breadcrumb truncate text-xs">
              {title} <span>/</span> {activeVenue?.name ?? 'Visión general'}
            </p>
            <Link
              aria-label="Ver la ficha pública como cliente"
              className="st-saas-preview-link inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium"
              params={{ slug }}
              rel="noreferrer"
              target="_blank"
              to="/reservar/$slug"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline">Ver como cliente</span>
            </Link>
          </div>
          <LogoutButton />
        </AppShellHeader>
        <nav
          aria-label="Navegación principal"
          className="st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-xs font-medium lg:hidden"
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
        <AppShellContent className="mx-auto max-w-7xl p-4 sm:p-6">{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  )
}
