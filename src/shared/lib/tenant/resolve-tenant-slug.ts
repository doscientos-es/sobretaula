import { parseTenantSlug } from './tenant-slug'

/**
 * Single point of tenant resolution (ADR-0003). Today the selector is the
 * `/t/:slug` path prefix; moving to `slug.sobretaula.app` only changes this
 * function, never its callers.
 */
export function resolveTenantSlug({
  hostname,
  pathname,
}: {
  hostname?: string
  pathname: string
}): string | null {
  void hostname

  const [, prefix, candidate] = pathname.split('/')
  if (prefix !== 't') return null

  return parseTenantSlug(candidate)
}
