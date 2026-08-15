import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: any

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()

self.addEventListener('push', (event: any) => {
  if (!event.data) return
  const data = event.data.json()
  const tag = data.tag || 'efa-notification'
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'EFA', {
        body: data.body || '',
        icon: '/icon-192.png',
        tag,
        data: { url: data.url || '/' },
        silent: false,
        vibrate: [200, 100, 200],
        renotify: true,
      })

      // Custom sound: if a window is open, tell it to play the sound (service
      // workers can't play audio; the client's AudioContext unlock handles
      // mobile autoplay). With no open client the OS/browser default
      // notification sound (silent: false) is the fallback.
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        if (clients.length > 0) {
          for (const client of clients) {
            client.postMessage({ type: 'play-notification-sound' })
          }
        }
      } catch {
        // ignore — system notification sound remains the fallback
      }
    })()
  )
})

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients: any[]) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.postMessage({ type: 'navigate', url })
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
