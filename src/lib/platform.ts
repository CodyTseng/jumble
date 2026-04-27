import type { TElectronBridge } from '../../electron/shared/ipc-types'

declare global {
  interface Window {
    electron?: TElectronBridge
  }
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electron
}

export const getElectronBridge = (): TElectronBridge | undefined => {
  return typeof window !== 'undefined' ? window.electron : undefined
}
