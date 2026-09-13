import { createFileRoute } from '@tanstack/react-router'

import { findTenantBySlug } from '@/features/tenancy/infrastructure/server/tenant-repository'
import { parseTenantSlug } from '@/shared/lib/tenant/tenant-slug'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ??
      character,
  )
}

export const Route = createFileRoute('/t/$slug/pwa-icon/svg')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = parseTenantSlug(params.slug)
        const tenant = slug ? await findTenantBySlug(slug) : null
        if (!tenant) return new Response('Not Found', { status: 404 })
        const label = escapeXml(initials(tenant.name))
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#ff5f4d"/><text x="256" y="300" fill="white" font-family="Arial,sans-serif" font-size="170" font-weight="700" text-anchor="middle">${label}</text></svg>`
        return new Response(svg, {
          headers: {
            'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
            'content-type': 'image/svg+xml',
          },
        })
      },
    },
  },
})
