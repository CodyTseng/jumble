import { describe, expect, it } from 'vitest'
import { App, Capacitor, LocalNotifications, registerPlugin } from './capacitor-web'

describe('Capacitor substitute for web and Electron', () => {
  it('never identifies the build as a native mobile runtime', () => {
    expect(Capacitor.isNativePlatform()).toBe(false)
    expect(Capacitor.getPlatform()).toBe('web')
  })

  it('allows registering native plugins during shared module initialization', async () => {
    const plugin = registerPlugin<{ ready(): Promise<void> }>('JumbleAppearance')
    await expect(plugin.ready()).rejects.toThrow('JumbleAppearance requires Android')
  })

  it('rejects unguarded native calls instead of reporting success', async () => {
    await expect(App.minimizeApp()).rejects.toThrow('only available in Android builds')
    await expect(LocalNotifications.requestPermissions()).rejects.toThrow(
      'only available in Android builds'
    )
  })
})
