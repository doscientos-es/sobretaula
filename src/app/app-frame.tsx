import {
  Button,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@doscientos/ui'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  CalendarDays,
  ConciergeBell,
  Coins,
  ExternalLink,
  FileText,
  Gift,
  LayoutDashboard,
  Mail,
  Map,
  Utensils,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import { useState, type MouseEvent, type ReactNode } from 'react'

import { AppShellFrame } from '@/app/app-shell-frame'
import { CurrentUserSidebar } from '@/features/auth'
import { resolveVenue, VenueSwitcher, type Venue } from '@/features/venues'
import type { Locale } from '@/shared/lib/i18n/locale'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

const navLinkClass =
  'st-saas-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

/** Tenant-management frame; shared shell structure lives in AppShellFrame. */
export function TenantAdminFrame({
  children,
  locale,
  navigationLocked = false,
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
}) {
  const effectiveLocale = useLocale(locale)
  const t = createTranslator(effectiveLocale)
  const navigate = useNavigate()
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const params = useParams({ strict: false })
  const activeVenue = resolveVenue(venues, params.venue ?? null)

  function handleLockedNavigation(event: MouseEvent<HTMLElement>) {
    if (!navigationLocked) return
    event.preventDefault()
    event.stopPropagation()
    setShowPaymentDialog(true)
  }

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
            {title} <span>/</span> {activeVenue?.name ?? t('app.overview')}
          </p>
          <Link
            aria-label={t('app.customerView')}
            className="st-saas-preview-link inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium"
            params={{ slug }}
            rel="noreferrer"
            target="_blank"
            to="/reservar/$slug"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">{t('app.customerView')}</span>
          </Link>
        </div>
      }
      headerClassName="st-saas-header flex h-11 items-center justify-between px-5 sm:px-6"
      locale={effectiveLocale}
      mainClassName="st-saas-main min-w-0 flex-1"
      mobileTabs={
        activeVenue ? (
          <nav
            aria-label={t('app.venueNavigation')}
            className={`st-mobile-nav flex gap-5 overflow-x-auto px-5 py-3 text-xs font-medium lg:hidden ${navigationLocked ? 'opacity-60' : ''}`}
          >
            <Link
              onClick={handleLockedNavigation}
              params={{ slug, venue: activeVenue.slug }}
              to="/t/$slug/l/$venue/tpv"
            >
              {t('nav.tpv')}
            </Link>
            <Link
              onClick={handleLockedNavigation}
              params={{ slug, venue: activeVenue.slug }}
              to="/t/$slug/l/$venue/plano"
            >
              {t('nav.floorPlan')}
            </Link>
            <Link
              onClick={handleLockedNavigation}
              params={{ slug, venue: activeVenue.slug }}
              to="/t/$slug/l/$venue/servicio"
            >
              {t('nav.service')}
            </Link>
            <Link
              onClick={handleLockedNavigation}
              params={{ slug, venue: activeVenue.slug }}
              to="/t/$slug/l/$venue/reservas"
            >
              {t('nav.reservations')}
            </Link>
          </nav>
        ) : null
      }
      sidebar={
        <>
          <Link
            to="/"
            className="st-saas-brand flex items-center gap-2 px-1.5 py-1.5 text-sm font-semibold tracking-tight"
          >
            <span className="st-saas-brand-mark">
              <Utensils className="size-3.5" />
            </span>
            <span className="font-semibold tracking-[-0.03em]">{t('app.name')}</span>
          </Link>
          <p className="st-saas-section-label mt-6 px-1.5">{t('app.restaurant')}</p>
          <nav aria-label={t('app.restaurant')} className="mt-3 space-y-0.5">
            <Link
              to="/t/$slug"
              params={{ slug }}
              activeOptions={{ exact: true }}
              activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
              className={navLinkClass}
            >
              <LayoutDashboard className="size-3" />
              {t('app.overview')}
            </Link>
          </nav>
          <VenueSwitcher
            activeVenueSlug={activeVenue?.slug ?? null}
            locale={effectiveLocale}
            tenantSlug={slug}
            venues={venues}
          />
          {activeVenue && (
            <div className="st-saas-nav-group mt-5 pt-4">
              <p className="st-saas-section-label px-1.5">{t('app.venueOperations')}</p>
              <nav aria-label={t('app.venueOperations')} className="mt-2 space-y-0.5">
                <Link
                  onClick={handleLockedNavigation}
                  to="/t/$slug/l/$venue/tpv"
                  params={{ slug, venue: activeVenue.slug }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                >
                  <Utensils className="size-3" />
                  TPV
                </Link>
                <Link
                  to="/t/$slug/l/$venue/plano"
                  params={{ slug, venue: activeVenue.slug }}
                  activeOptions={{ exact: true }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                  onClick={handleLockedNavigation}
                >
                  <Map className="size-3" />
                  {t('nav.floorPlan')}
                </Link>
                <Link
                  to="/t/$slug/l/$venue/servicio"
                  params={{ slug, venue: activeVenue.slug }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                  onClick={handleLockedNavigation}
                >
                  <ConciergeBell className="size-3" />
                  {t('nav.service')}
                </Link>
                <Link
                  to="/t/$slug/l/$venue/reservas"
                  params={{ slug, venue: activeVenue.slug }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                  onClick={handleLockedNavigation}
                >
                  <CalendarDays className="size-3" />
                  {t('nav.reservations')}
                </Link>
              </nav>
            </div>
          )}
          <div className="st-saas-nav-group mt-5 pt-4">
            <p className="st-saas-section-label px-1.5">{t('app.restaurantManagement')}</p>
            <nav aria-label={t('app.restaurantManagement')} className="mt-2 space-y-0.5">
              <Link
                to="/t/$slug/carta"
                params={{ slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
                onClick={handleLockedNavigation}
              >
                <UtensilsCrossed className="size-3" />
                {t('nav.menu')}
              </Link>
              <Link
                to="/t/$slug/facturacion"
                params={{ slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
                onClick={handleLockedNavigation}
              >
                <FileText className="size-3" />
                {t('nav.billing')}
              </Link>
              <Link
                to="/t/$slug/facturas"
                params={{ slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
                onClick={handleLockedNavigation}
              >
                <FileText className="size-3" />
                {t('nav.invoices')}
              </Link>
              {activeVenue && (
                <Link
                  onClick={handleLockedNavigation}
                  to="/t/$slug/l/$venue/propinas"
                  params={{ slug, venue: activeVenue.slug }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                >
                  <Coins className="size-3" />
                  Propinas
                </Link>
              )}
              {activeVenue && (
                <Link
                  onClick={handleLockedNavigation}
                  to="/t/$slug/l/$venue/tarjetas-regalo"
                  params={{ slug, venue: activeVenue.slug }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                >
                  <Gift className="size-3" />
                  Tarjetas regalo
                </Link>
              )}
              {activeVenue && (
                <Link
                  onClick={handleLockedNavigation}
                  to="/t/$slug/l/$venue/fidelizacion"
                  params={{ slug, venue: activeVenue.slug }}
                  activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                  className={navLinkClass}
                >
                  <Gift className="size-3" />
                  Fidelización
                </Link>
              )}
              <Link
                to="/t/$slug/comunicaciones"
                params={{ slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
                onClick={handleLockedNavigation}
              >
                <Mail className="size-3" />
                {t('app.communications')}
              </Link>
              <Link
                to="/t/$slug/equipo"
                params={{ slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
                onClick={handleLockedNavigation}
              >
                <Users className="size-3" />
                {t('app.team')}
              </Link>
            </nav>
          </div>
          <div className="st-saas-nav-group mt-5 pt-4">
            <p className="st-saas-section-label px-1.5">{t('app.account')}</p>
            <nav className="mt-2">
              <Link
                to="/t/$slug/suscripcion/facturas"
                params={{ slug }}
                activeProps={{ className: `${navLinkClass} st-saas-nav-link--active` }}
                className={navLinkClass}
              >
                <FileText className="size-3" />
                {t('app.subscription')}
              </Link>
            </nav>
          </div>
          <CurrentUserSidebar locale={effectiveLocale} />
        </>
      }
      sidebarClassName="st-saas-sidebar hidden w-56 p-3 lg:flex lg:h-svh lg:flex-col"
    >
      {children}
      {showPaymentDialog && (
        <DialogRoot onOpenChange={setShowPaymentDialog} open>
          <DialogContent className="max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{t('app.paymentRequiredTitle')}</DialogTitle>
              <DialogDescription>{t('app.paymentRequiredDescription')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t('app.paymentNotNow')}
                </Button>
              </DialogClose>
              <Button
                onPress={() => {
                  setShowPaymentDialog(false)
                  void navigate({ to: '/t/$slug/suscripcion/facturas', params: { slug } })
                }}
                type="button"
              >
                {t('app.goToSubscription')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      )}
    </AppShellFrame>
  )
}
