import { contextBridge, ipcRenderer } from 'electron'
import type { Event as NEvent, Filter } from 'nostr-tools'
import {
  IPC_CHANNELS,
  TAuthRequestPayload,
  TAuthResponsePayload,
  TElectronBridge,
  TSecretsBundle,
  TSubClosePayload,
  TSubEosePayload,
  TSubEventPayload,
  TUpdateState
} from '../shared/ipc-types.js'

const bridge: TElectronBridge = {
  relay: {
    ensure: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.ensure, url),
    publish: (url: string, event: NEvent, timeoutMs: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.publish, url, event, timeoutMs),
    subscribe: (subId: string, url: string, filters: Filter[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.subscribe, subId, url, filters),
    closeSub: (subId: string) => ipcRenderer.invoke(IPC_CHANNELS.closeSub, subId),
    auth: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.auth, url),
    close: (urls?: string[]) => ipcRenderer.invoke(IPC_CHANNELS.close, urls),
    setAllowInsecure: (allow: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.setAllowInsecure, allow),
    onSubEvent: (cb) => {
      const listener = (_e: unknown, payload: TSubEventPayload) => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.subEvent, listener)
      return () => ipcRenderer.off(IPC_CHANNELS.subEvent, listener)
    },
    onSubEose: (cb) => {
      const listener = (_e: unknown, payload: TSubEosePayload) => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.subEose, listener)
      return () => ipcRenderer.off(IPC_CHANNELS.subEose, listener)
    },
    onSubClose: (cb) => {
      const listener = (_e: unknown, payload: TSubClosePayload) => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.subClose, listener)
      return () => ipcRenderer.off(IPC_CHANNELS.subClose, listener)
    },
    onAuthRequest: (cb) => {
      const listener = (_e: unknown, payload: TAuthRequestPayload) => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.authRequest, listener)
      return () => ipcRenderer.off(IPC_CHANNELS.authRequest, listener)
    },
    sendAuthResponse: (payload: TAuthResponsePayload) =>
      ipcRenderer.send(IPC_CHANNELS.authResponse, payload)
  },
  secrets: {
    isAvailable: () => ipcRenderer.invoke(IPC_CHANNELS.secretsAvailable),
    load: () => ipcRenderer.invoke(IPC_CHANNELS.secretsLoad),
    save: (bundle: TSecretsBundle) => ipcRenderer.invoke(IPC_CHANNELS.secretsSave, bundle)
  },
  update: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.updateCheck),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.updateDownload),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.updateInstall),
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.updateGetState),
    onState: (cb) => {
      const listener = (_e: unknown, payload: TUpdateState) => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.updateState, listener)
      return () => ipcRenderer.off(IPC_CHANNELS.updateState, listener)
    },
    setAutoUpdate: (enabled: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.updateSetAuto, enabled)
  }
}

contextBridge.exposeInMainWorld('electron', bridge)
