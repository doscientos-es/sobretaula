import { createFileRoute } from '@tanstack/react-router'

import { findTenantBySlug } from '@/features/tenancy/infrastructure/server/tenant-repository'
import { parseTenantSlug } from '@/shared/lib/tenant/tenant-slug'

function manifestIconUrl(slug: string, size: number) {
  return `/t/${encodeURIComponent(slug)}/pwa-icon.svg?size=${size}`
}

export const Route = createFileRoute('/t/$slug/manifest/webmanifest')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = parseTenantSlug(params.slug)
        if (!slug) return new Response('Not Found', { status: 404 })
        const tenant = await findTenantBySlug(slug)
        if (!tenant) return new Response('Not Found', { status: 404 })

        const origin = new URL(request.url).origin
        const manifest = {
          id: `/t/${tenant.slug}`,
          name: tenant.name,
          short_name: tenant.name,
          description: `Gestión de ${tenant.name}`,
          lang: tenant.defaultLocale,
          start_url: `/t/${tenant.slug}`,
          scope: `/t/${tenant.slug}`,
          display: 'standalone',
          background_color: '#f7f7f7',
          theme_color: '#ff5f4d',
          icons: [
            {
              src: `${origin}${manifestIconUrl(tenant.slug, 192)}`,
              sizes: '192x192',
              type: 'image/svg+xml',
            },
            {
              src: `${origin}${manifestIconUrl(tenant.slug, 512)}`,
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        }

        return new Response(JSON.stringify(manifest), {
          headers: {
            'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
            'content-type': 'application/manifest+json; charset=utf-8',
          },
        })
      },
    },
  },
})
