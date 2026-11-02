import { Capacitor } from '@capacitor/core'
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

/** Native mobile runtime, independent of viewport size or user agent. */
export const isNative = (): boolean => Capacitor.isNativePlatform()
export const isAndroid = (): boolean => isNative() && Capacitor.getPlatform() === 'android'
