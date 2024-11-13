import { TElectronWindow } from '@common/types'

export function isElectron(w: any): w is TElectronWindow {
  return !!w.electron && !!w.api
}

export function isMacOS() {
  return isElectron(window) && window.electron.process.platform === 'darwin'
}

export const IS_ELECTRON = isElectron(window)
