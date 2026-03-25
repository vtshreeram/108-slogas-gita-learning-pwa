// Service worker extension for Web Push notifications
// This file is imported by the Workbox-generated SW via importScripts

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'Gita Sadhana'
  const body = data.body ?? 'Time for your daily practice 🙏'
  const icon = '/icons/icon-192.png'
  const badge = '/icons/icon-192.png'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: 'daily-reminder',
      renotify: true,
      data: { url: '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
