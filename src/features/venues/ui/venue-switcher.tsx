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
      <p className="text-muted-foreground mt-8 px-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {t('venue.section')}
      </p>
      {venues.length === 0 ? (
        <p className="text-muted-foreground mt-3 px-2 text-sm">{t('venue.empty')}</p>
      ) : (
        <nav aria-label={t('venue.section')} className="mt-3 space-y-1">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              to="/t/$slug/l/$venue"
              params={{ slug: tenantSlug, venue: venue.slug }}
              aria-current={venue.slug === activeVenueSlug ? 'true' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                venue.slug === activeVenueSlug
                  ? 'bg-secondary text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Store className="size-4" />
              <span className="truncate">{venue.name}</span>
            </Link>
          ))}
        </nav>
      )}
      <Link
        to="/t/$slug/l/nuevo"
        params={{ slug: tenantSlug }}
        className="text-muted-foreground hover:bg-secondary hover:text-foreground mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
      >
        <Plus className="size-4" />
        {t('venue.create.title')}
      </Link>
    </div>
  )
}
