// EFA Service Worker — handles push notifications

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'EFA', body: event.data.text() } }

  const options = {
    body: data.body ?? '',
    icon: '/icons/efa-icon-192.png',
    badge: '/icons/efa-icon-192.png',
    tag: data.tag ?? 'efa-notification',
    data: { url: data.url ?? '/' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction ?? false,
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'EFA', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing EFA tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url)
    })
  )
})
