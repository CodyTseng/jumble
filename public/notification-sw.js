const NOTIFICATION_CLICK_MESSAGE = 'system-notification:click'

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawTarget = event.notification.data?.target
  const target =
    typeof rawTarget === 'string' && rawTarget.startsWith('/') && !rawTarget.startsWith('//')
      ? rawTarget
      : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const client = clients[0]
      if (client) {
        client.postMessage({ type: NOTIFICATION_CLICK_MESSAGE, target })
        await client.focus()
        return
      }
      await self.clients.openWindow(target)
    })
  )
})
