import { ipcMain } from 'electron'
import type { Event as NEvent, Filter } from 'nostr-tools'
import {
  IPC_CHANNELS,
  TAuthResponsePayload,
  TProxyFetchOptions,
  TSecretsBundle
} from '../shared/ipc-types.js'
import { proxyFetch } from './proxy-fetch.js'
import type { RelayManager } from './relay-manager.js'
import type { SecretsStore } from './secrets-store.js'
import type { Updater } from './updater.js'

export function registerIpcHandlers(
  manager: RelayManager,
  secrets: SecretsStore,
  updater: Updater
) {
  ipcMain.handle(IPC_CHANNELS.ensure, (_e, url: string) => manager.ensure(url))

  ipcMain.handle(
    IPC_CHANNELS.publish,
    (_e, url: string, event: NEvent, timeoutMs: number) => manager.publish(url, event, timeoutMs)
  )

  ipcMain.handle(
    IPC_CHANNELS.subscribe,
    (_e, subId: string, url: string, filters: Filter[]) =>
      manager.subscribe(subId, url, filters)
  )

  ipcMain.handle(IPC_CHANNELS.closeSub, (_e, subId: string) => manager.closeSub(subId))

  ipcMain.handle(IPC_CHANNELS.auth, (_e, url: string) => manager.auth(url))

  ipcMain.handle(IPC_CHANNELS.close, (_e, urls?: string[]) => manager.close(urls))

  ipcMain.handle(IPC_CHANNELS.setAllowInsecure, (_e, allow: boolean) =>
    manager.setAllowInsecure(allow)
  )

  ipcMain.on(IPC_CHANNELS.authResponse, (_e, payload: TAuthResponsePayload) =>
    manager.handleAuthResponse(payload)
  )

  ipcMain.handle(IPC_CHANNELS.secretsAvailable, () => secrets.isAvailable())
  ipcMain.handle(IPC_CHANNELS.secretsLoad, () => secrets.load())
  ipcMain.handle(IPC_CHANNELS.secretsSave, (_e, bundle: TSecretsBundle) => secrets.save(bundle))

  ipcMain.handle(IPC_CHANNELS.proxyFetch, (_e, url: string, options?: TProxyFetchOptions) =>
    proxyFetch(url, options)
  )

  ipcMain.handle(IPC_CHANNELS.updateCheck, () => updater.check())
  ipcMain.handle(IPC_CHANNELS.updateDownload, () => updater.download())
  ipcMain.handle(IPC_CHANNELS.updateInstall, () => updater.install())
  ipcMain.handle(IPC_CHANNELS.updateGetState, () => updater.getState())
}

export function unregisterIpcHandlers() {
  Object.values(IPC_CHANNELS).forEach((ch) => {
    ipcMain.removeHandler(ch)
    ipcMain.removeAllListeners(ch)
  })
}
