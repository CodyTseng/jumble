import { afterEach, describe, expect, it, vi } from 'vitest'
import { PwaSystemNotificationAdapter } from './pwa'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PwaSystemNotificationAdapter', () => {
  it('shows notifications through the service worker registration', async () => {
    const showNotification = vi.fn(async () => undefined)
    class NotificationMock {
      static permission: NotificationPermission = 'granted'
      static requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
    }
    class ServiceWorkerRegistrationMock {
      showNotification() {}
    }
    vi.stubGlobal('window', {
      Notification: NotificationMock,
      ServiceWorkerRegistration: ServiceWorkerRegistrationMock
    })
    vi.stubGlobal('Notification', NotificationMock)
    vi.stubGlobal('ServiceWorkerRegistration', ServiceWorkerRegistrationMock)
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({ showNotification }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    })

    const adapter = new PwaSystemNotificationAdapter()
    await expect(
      adapter.show({ id: 'event-id', title: 'Jumble', body: 'New reply', target: '/notes/1' })
    ).resolves.toBe(true)
    expect(showNotification).toHaveBeenCalledWith(
      'Jumble',
      expect.objectContaining({
        body: 'New reply',
        tag: 'event-id',
        data: { target: '/notes/1' }
      })
    )
  })

  it('does not show a notification without permission', async () => {
    const showNotification = vi.fn()
    class NotificationMock {
      static permission: NotificationPermission = 'default'
    }
    class ServiceWorkerRegistrationMock {
      showNotification() {}
    }
    vi.stubGlobal('window', {
      Notification: NotificationMock,
      ServiceWorkerRegistration: ServiceWorkerRegistrationMock
    })
    vi.stubGlobal('Notification', NotificationMock)
    vi.stubGlobal('ServiceWorkerRegistration', ServiceWorkerRegistrationMock)
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({ showNotification }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    })

    const adapter = new PwaSystemNotificationAdapter()
    await expect(adapter.show({ id: 'event-id', title: 'Jumble' })).resolves.toBe(false)
    expect(showNotification).not.toHaveBeenCalled()
  })
})
