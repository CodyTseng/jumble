import { getElectronBridge, isElectron } from '@/lib/platform'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { TUpdateState } from '../../electron/shared/ipc-types'

const APP_VERSION = (import.meta.env.APP_VERSION as string | undefined) ?? ''

const DEFAULT_STATE: TUpdateState = {
  status: 'idle',
  currentVersion: APP_VERSION,
  supported: false
}

type TUpdaterContext = {
  state: TUpdateState
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
}

const UpdaterContext = createContext<TUpdaterContext | undefined>(undefined)

export function UpdaterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TUpdateState>(DEFAULT_STATE)

  useEffect(() => {
    if (!isElectron()) return
    const bridge = getElectronBridge()
    if (!bridge) return

    let mounted = true
    bridge.update.getState().then((s) => {
      if (mounted) setState(s)
    })
    const off = bridge.update.onState((s) => {
      if (mounted) setState(s)
    })
    return () => {
      mounted = false
      off()
    }
  }, [])

  const check = useCallback(async () => {
    const bridge = getElectronBridge()
    if (!bridge) return
    const s = await bridge.update.check()
    setState(s)
  }, [])

  const download = useCallback(async () => {
    const bridge = getElectronBridge()
    if (!bridge) return
    await bridge.update.download()
  }, [])

  const install = useCallback(async () => {
    const bridge = getElectronBridge()
    if (!bridge) return
    await bridge.update.install()
  }, [])

  return (
    <UpdaterContext.Provider value={{ state, check, download, install }}>
      {children}
    </UpdaterContext.Provider>
  )
}

export function useUpdater(): TUpdaterContext {
  const ctx = useContext(UpdaterContext)
  if (!ctx) {
    throw new Error('useUpdater must be used within UpdaterProvider')
  }
  return ctx
}
