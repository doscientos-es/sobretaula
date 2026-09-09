import { Link } from '@tanstack/react-router'
import { Plus, Store } from 'lucide-react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

import type { Venue } from '../domain/venue'

/**
 * Lists the locals the user reaches inside the company so switching is one
 * click away from anywhere in the app.
 */
export function VenueSwitcher({
  activeVenueSlug,
  locale,
  tenantSlug,
  venues,
}: {
  activeVenueSlug: string | null
  locale: Locale
  tenantSlug: string
  venues: readonly Venue[]
}) {
  const t = createTranslator(locale)

  return (
    <div>
      <div className="st-saas-nav-group mt-5 pt-4">
        <p className="st-saas-section-label px-1.5">{t('venue.section')}</p>
        {venues.length === 0 ? (
          <p className="st-saas-empty-state mt-3 px-2">{t('venue.empty')}</p>
        ) : (
          <nav aria-label={t('venue.section')} className="mt-2 space-y-0.5">
            {venues.map((venue) => (
              <Link
                key={venue.id}
                to="/t/$slug/l/$venue"
                params={{ slug: tenantSlug, venue: venue.slug }}
                aria-current={venue.slug === activeVenueSlug ? 'true' : undefined}
                className={`st-saas-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  venue.slug === activeVenueSlug ? 'st-saas-nav-link--active' : ''
                }`}
              >
                <Store className="size-3" />
                <span className="truncate">{venue.name}</span>
              </Link>
            ))}
          </nav>
        )}
        <Link
          to="/t/$slug/l/nuevo"
          params={{ slug: tenantSlug }}
          className="st-saas-nav-link mt-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
        >
          <Plus className="size-3" />
          {t('venue.create.title')}
        </Link>
      </div>
    </div>
  )
}
