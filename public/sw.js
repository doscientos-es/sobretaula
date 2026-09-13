const CACHE_PREFIX = 'sobretaula-static-'
const CACHE_VERSION = new URL(self.location.href).searchParams.get('v') ?? 'dev'
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`
const STATIC_ASSETS = ['/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const isStaticAsset = url.pathname.startsWith('/assets/') || STATIC_ASSETS.includes(url.pathname)
  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() ?? '' }
  }

  const title = typeof payload.title === 'string' ? payload.title : 'SobreTaula'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Tienes una actualización importante.',
    data: { url: typeof payload.url === 'string' ? payload.url : '/' },
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: typeof payload.tag === 'string' ? payload.tag : 'sobretaula',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client)
      if (existing) {
        void existing.navigate(targetUrl)
        return existing.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
