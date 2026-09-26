import { BrowserWindow, ipcMain } from 'electron'
import type { Event as NEvent, Filter } from 'nostr-tools'
import {
  IPC_CHANNELS,
  TAuthResponsePayload,
  TLocalStorageSnapshot,
  TPomegranateAuthPurpose,
  TProxyFetchOptions,
  TSecretsBundle,
  TSecurityStatus
} from '../shared/ipc-types.js'
import type { TSystemNotificationPayload } from '../shared/ipc-types.js'
import type { MediaServer } from './media-server.js'
import type { PasswordCrypto } from './password-crypto.js'
import type { PomegranateAuthServer } from './pomegranate-auth-server.js'
import { proxyFetch } from './proxy-fetch.js'
import type { RelayManager } from './relay-manager.js'
import type { RendererStorageStore } from './renderer-storage-store.js'
import type { SecretsStore } from './secrets-store.js'
import type { ElectronSystemNotificationService } from './system-notification.js'
import type { Updater } from './updater.js'

export type TSecurityContext = {
  /** Which backend encrypts the on-disk stores for this installation. */
  backend: 'safeStorage' | 'password'
  passwordCrypto: PasswordCrypto
  secrets: SecretsStore
  rendererStorage: RendererStorageStore
}

export function registerIpcHandlers(
  manager: RelayManager,
  secrets: SecretsStore,
  updater: Updater,
  mediaServer: MediaServer,
  pomegranateAuthServer: PomegranateAuthServer,
  rendererStorage: RendererStorageStore,
  security: TSecurityContext,
  systemNotification: ElectronSystemNotificationService
) {
  ipcMain.handle(IPC_CHANNELS.checkRelays, () => manager.checkRelays())

  ipcMain.handle(IPC_CHANNELS.setNetworkOnline, (_e, online: boolean) =>
    manager.setNetworkOnline(online)
  )

  ipcMain.handle(IPC_CHANNELS.publish, (_e, url: string, event: NEvent, timeoutMs: number) =>
    manager.publish(url, event, timeoutMs)
  )

  ipcMain.handle(IPC_CHANNELS.subscribe, (_e, subId: string, url: string, filters: Filter[]) =>
    manager.subscribe(subId, url, filters)
  )

  ipcMain.handle(IPC_CHANNELS.closeSub, (_e, subId: string) => manager.closeSub(subId))

  ipcMain.handle(IPC_CHANNELS.auth, (_e, url: string) => manager.auth(url))

  ipcMain.handle(IPC_CHANNELS.close, (_e, urls?: string[]) => manager.close(urls))

  ipcMain.handle(IPC_CHANNELS.setAllowInsecure, (_e, allow: boolean) =>
    manager.setAllowInsecure(allow)
  )

  ipcMain.handle(IPC_CHANNELS.setTrustedInsecureUrls, (_e, urls: string[]) =>
    manager.setTrustedInsecureRelayUrls(urls)
  )

  ipcMain.on(IPC_CHANNELS.authResponse, (_e, payload: TAuthResponsePayload) =>
    manager.handleAuthResponse(payload)
  )

  ipcMain.handle(IPC_CHANNELS.secretsAvailable, () => secrets.isAvailable())
  ipcMain.handle(IPC_CHANNELS.secretsLoad, () => secrets.load())
  ipcMain.handle(IPC_CHANNELS.secretsSave, (_e, bundle: TSecretsBundle) => secrets.save(bundle))
  ipcMain.handle(IPC_CHANNELS.localStorageLoad, () => rendererStorage.load())
  ipcMain.handle(IPC_CHANNELS.localStorageSave, (_e, snapshot: TLocalStorageSnapshot) =>
    rendererStorage.save(snapshot)
  )

  const { passwordCrypto } = security
  ipcMain.handle(IPC_CHANNELS.securityGetStatus, async (): Promise<TSecurityStatus> => {
    const isPassword = security.backend === 'password'
    return {
      backend: security.backend,
      unlocked: !isPassword || passwordCrypto.isReady(),
      needsSetup: isPassword && !(await passwordCrypto.hasParams())
    }
  })
  ipcMain.handle(IPC_CHANNELS.securitySetupPassword, (_e, password: string) => {
    if (typeof password !== 'string' || password.length === 0) {
      return Promise.reject(new Error('password must be a non-empty string'))
    }
    return passwordCrypto.setup(password)
  })
  ipcMain.handle(IPC_CHANNELS.securityUnlock, (_e, password: string) =>
    passwordCrypto.unlock(typeof password === 'string' ? password : '')
  )
  ipcMain.handle(IPC_CHANNELS.securityReset, async () => {
    await passwordCrypto.reset()
    await Promise.all([security.secrets.deleteAll(), security.rendererStorage.deleteAll()])
  })

  ipcMain.handle(IPC_CHANNELS.updateCheck, () => updater.check())
  ipcMain.handle(IPC_CHANNELS.updateDownload, () => updater.download())
  ipcMain.handle(IPC_CHANNELS.updateInstall, () => updater.install())
  ipcMain.handle(IPC_CHANNELS.updateGetState, () => updater.getState())
  ipcMain.handle(IPC_CHANNELS.updateSetAuto, (_e, enabled: boolean) =>
    updater.setAutoUpdate(enabled)
  )

  ipcMain.handle(IPC_CHANNELS.systemNotificationSupported, () => systemNotification.isSupported())
  ipcMain.handle(
    IPC_CHANNELS.systemNotificationShow,
    (event, payload: TSystemNotificationPayload) => {
      const window = event.sender ? BrowserWindow.fromWebContents(event.sender) : null
      return systemNotification.show(payload, window)
    }
  )

  ipcMain.handle(IPC_CHANNELS.proxyFetch, (_e, url: string, options?: TProxyFetchOptions) =>
    proxyFetch(url, options)
  )

  // The YouTube shim is not part of application startup. Bind its loopback
  // server only when a YouTube player actually needs it.
  ipcMain.handle(IPC_CHANNELS.mediaGetShimOrigin, () => mediaServer.start())
  ipcMain.handle(
    IPC_CHANNELS.pomegranateAuthenticate,
    (_e, url: string, purpose: TPomegranateAuthPurpose) =>
      pomegranateAuthServer.authenticate(url, purpose)
  )
  ipcMain.handle(
    IPC_CHANNELS.pomegranateRecover,
    (_e, centralLoginUrl: string, expectedPubkey: string) =>
      pomegranateAuthServer.recover(centralLoginUrl, expectedPubkey)
  )
}

export function unregisterIpcHandlers() {
  Object.values(IPC_CHANNELS).forEach((ch) => {
    ipcMain.removeHandler(ch)
    ipcMain.removeAllListeners(ch)
  })
}
