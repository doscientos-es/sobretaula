export interface Venue {
  id: string
  isActive: boolean
  name: string
  slug: string
}

/**
 * Resolves the local addressed by the URL. Without a slug the first local is
 * the only sensible default, which keeps the single-local tenant unaware of
 * the selector.
 */
export function resolveVenue(venues: readonly Venue[], slug: string | null): Venue | null {
  if (!slug) return venues[0] ?? null
  return venues.find((venue) => venue.slug === slug) ?? null
}
