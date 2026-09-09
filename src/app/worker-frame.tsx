import { Link, useParams } from '@tanstack/react-router'
import { CalendarDays, ConciergeBell, Map, Utensils } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppShellFrame } from '@/app/app-shell-frame'
import { LogoutButton } from '@/features/auth'
import { resolveVenue, VenueSwitcher, type Venue } from '@/features/venues'
import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

const navLinkClass =
  'st-saas-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

export function WorkerFrame({
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
  const venueParams = activeVenue ? { slug, venue: activeVenue.slug } : null

  return (
    <AppShellFrame
      className="st-app-frame st-saas-frame"
      contentClassName="mx-auto max-w-7xl p-4 sm:p-6"
      header={
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="st-saas-brand-mark lg:hidden">
              <Utensils className="size-3" />
            </span>
            <p className="st-saas-breadcrumb truncate text-xs">
              {title} <span>/</span> {activeVenue?.name ?? 'Selecciona un local'}
            </p>
          </div>
          <LogoutButton />
        </>
      }
      headerClassName="st-saas-header flex h-11 items-center justify-between px-5 sm:px-6"
      mainClassName="st-saas-main min-w-0 flex-1"
      mobileNavigation={
        <nav
          aria-label="Navegación de operación"
          className="st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-xs font-medium lg:hidden"
        >
          {venueParams && (
            <>
              <Link params={venueParams} to="/t/$slug/l/$venue/plano">
                Plano
              </Link>
              <Link params={venueParams} to="/t/$slug/l/$venue/servicio">
                Servicio
              </Link>
              <Link params={venueParams} to="/t/$slug/l/$venue/reservas">
                Reservas
              </Link>
            </>
          )}
        </nav>
      }
      sidebar={
        <>
          <Link
            className="st-saas-brand flex items-center gap-2 px-1.5 py-1.5 text-sm font-semibold tracking-tight"
            to="/"
          >
            <span className="st-saas-brand-mark">
              <Utensils className="size-3.5" />
            </span>
            <span className="font-semibold tracking-[-0.03em]">{t('app.name')}</span>
          </Link>
          <p className="st-saas-section-label mt-6 px-1.5">Operación</p>
          <nav aria-label="Operación del restaurante" className="mt-3 space-y-0.5">
            {venueParams && (
              <>
                <Link
                  activeOptions={{ exact: true }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                  params={venueParams}
                  to="/t/$slug/l/$venue/plano"
                >
                  <Map className="size-3" /> {t('nav.floorPlan')}
                </Link>
                <Link
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                  params={venueParams}
                  to="/t/$slug/l/$venue/servicio"
                >
                  <ConciergeBell className="size-3" /> {t('nav.service')}
                </Link>
                <Link
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                  params={venueParams}
                  to="/t/$slug/l/$venue/reservas"
                >
                  <CalendarDays className="size-3" /> {t('nav.reservations')}
                </Link>
              </>
            )}
          </nav>
          <VenueSwitcher
            activeVenueSlug={activeVenue?.slug ?? null}
            locale={locale}
            tenantSlug={slug}
            venues={venues}
          />
        </>
      }
      sidebarClassName="st-saas-sidebar hidden w-56 p-3 lg:block"
    >
      {children}
    </AppShellFrame>
  )
}
