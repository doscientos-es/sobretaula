import { Link, useParams } from '@tanstack/react-router'
import { CalendarDays, ConciergeBell, Map, Utensils } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppShellFrame } from '@/app/app-shell-frame'
import { CurrentUserSidebar } from '@/features/auth'
import type { TenantRole } from '@/features/tenancy'
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
  navigationLocked?: boolean
  slug: string
  title: string
  venues: readonly Venue[]
  role?: TenantRole
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="st-saas-brand-mark lg:hidden">
            <Utensils className="size-3" />
          </span>
          <p className="st-saas-breadcrumb truncate text-xs">
            {title} <span>/</span> {activeVenue?.name ?? t('common.selectVenue')}
          </p>
        </div>
      }
      headerClassName="st-saas-header flex h-11 items-center justify-between px-5 sm:px-6"
      locale={locale}
      mainClassName="st-saas-main min-w-0 flex-1"
      mobileTabs={
        <nav
          aria-label={t('app.venueOperations')}
          className="st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-xs font-medium lg:hidden"
        >
          {venueParams && (
            <>
              <Link params={venueParams} to="/t/$slug/l/$venue/tpv">
                {t('nav.tpv')}
              </Link>
              <Link params={venueParams} to="/t/$slug/l/$venue/plano">
                {t('nav.floorPlan')}
              </Link>
              <Link params={venueParams} to="/t/$slug/l/$venue/servicio">
                {t('nav.service')}
              </Link>
              <Link params={venueParams} to="/t/$slug/l/$venue/reservas">
                {t('nav.reservations')}
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
          <p className="st-saas-section-label mt-6 px-1.5">{t('app.venueOperations')}</p>
          <nav aria-label={t('app.venueOperations')} className="mt-3 space-y-0.5">
            {venueParams && (
              <>
                <Link
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                  params={venueParams}
                  to="/t/$slug/l/$venue/tpv"
                >
                  <Utensils className="size-3" /> {t('nav.tpv')}
                </Link>
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
          <CurrentUserSidebar locale={locale} />
        </>
      }
      sidebarClassName="st-saas-sidebar hidden w-56 p-3 lg:flex lg:h-svh lg:flex-col"
    >
      {children}
    </AppShellFrame>
  )
}
