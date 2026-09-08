const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/

/** Slugs reserved under /t/$slug/l so they can never become a venue path. */
export const RESERVED_VENUE_SLUGS = new Set(['l', 'nuevo'])

export function isValidVenueSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && !value.includes('--') && !RESERVED_VENUE_SLUGS.has(value)
}

/**
 * Normalises a candidate venue slug. Returns null when it cannot address a
 * venue. The slug only selects: access is always proven server side.
 */
export function parseVenueSlug(value: string | null | undefined): string | null {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  return isValidVenueSlug(normalized) ? normalized : null
}
