import { nativeUrlToPath } from '@/lib/native-navigation'
import { isAndroid } from '@/lib/platform'
import modalManager from '@/services/modal-manager.service'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { useEffect, useRef } from 'react'

/** Adapt native navigation to the existing page stack and modal manager. */
export function useNativeNavigation(hasSecondaryPage: boolean, push: (path: string) => void) {
  const current = useRef({ hasSecondaryPage, push })
  useEffect(() => {
    current.current = { hasSecondaryPage, push }
  })

  useEffect(() => {
    if (!isAndroid()) return
    let disposed = false
    const listeners: PluginListenerHandle[] = []
    const keep = async (pending: Promise<PluginListenerHandle>) => {
      const listener = await pending
      if (disposed) await listener.remove()
      else listeners.push(listener)
    }
    const open = (url: string) => {
      if (disposed) return
      const path = nativeUrlToPath(url)
      if (path) current.current.push(path)
    }
    void Promise.all([
      keep(
        App.addListener('backButton', () => {
          if (disposed || modalManager.pop()) return
          if (current.current.hasSecondaryPage) window.history.back()
          else void App.minimizeApp().catch(console.error)
        })
      ),
      keep(App.addListener('appUrlOpen', ({ url }) => open(url)))
    ])
      .then(async () => {
        // Register before reading the cold-start URL so warm links cannot be missed.
        const launch = await App.getLaunchUrl()
        if (launch) open(launch.url)
      })
      .catch((error) => console.error('[native] navigation setup failed:', error))

    return () => {
      disposed = true
      for (const listener of listeners) void listener.remove()
    }
  }, [])
}
