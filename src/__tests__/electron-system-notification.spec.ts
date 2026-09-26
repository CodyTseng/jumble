import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class NotificationMock {
    static instances: NotificationMock[] = []
    static isSupported = vi.fn(() => true)

    listeners = new Map<string, () => void>()
    show = vi.fn()

    constructor(public options: { title: string; body?: string }) {
      NotificationMock.instances.push(this)
    }

    once(event: string, listener: () => void) {
      this.listeners.set(event, listener)
      return this
    }

    on(event: string, listener: () => void) {
      this.listeners.set(event, listener)
      return this
    }

    emit(event: string) {
      this.listeners.get(event)?.()
    }
  }

  return { NotificationMock }
})

vi.mock('electron', () => ({
  BrowserWindow: class {},
  Notification: mocks.NotificationMock
}))

import { ElectronSystemNotificationService } from '../../electron/main/system-notification'

describe('ElectronSystemNotificationService', () => {
  beforeEach(() => {
    mocks.NotificationMock.instances = []
    vi.clearAllMocks()
  })

  it('shows a notification and focuses the window when it is clicked', () => {
    const send = vi.fn()
    const window = {
      isDestroyed: () => false,
      isMinimized: () => true,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      webContents: { send }
    }
    const service = new ElectronSystemNotificationService()

    expect(
      service.show(
        { id: 'event-id', title: 'Jumble', body: 'New reply', target: '/?page=notifications' },
        window as never
      )
    ).toBe(true)

    const notification = mocks.NotificationMock.instances[0]
    expect(notification.show).toHaveBeenCalledOnce()
    notification.emit('click')
    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith('system-notification:click', '/?page=notifications')
  })

  it('rejects external click targets', () => {
    const service = new ElectronSystemNotificationService()

    expect(service.show({ id: 'event-id', title: 'Jumble', target: 'https://example.com' })).toBe(
      false
    )
    expect(mocks.NotificationMock.instances).toHaveLength(0)
  })
})
