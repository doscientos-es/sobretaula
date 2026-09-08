const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/

/** Slugs reserved by the platform so they can never become a tenant path. */
export const RESERVED_TENANT_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'login',
  'static',
  't',
  'www',
])

export function isValidTenantSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && !value.includes('--') && !RESERVED_TENANT_SLUGS.has(value)
}

/**
 * Normalises a candidate slug. Returns null when it cannot be a tenant slug.
 * The slug is only a selector: membership is always proven server side.
 */
export function parseTenantSlug(value: string | null | undefined): string | null {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  return isValidTenantSlug(normalized) ? normalized : null
}
