import { TRelayGroup, TThemeSetting } from '@common/types'
import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  theme: {
    onChange: (cb: (theme: 'dark' | 'light') => void) => {
      ipcRenderer.on('theme:change', (_, theme) => {
        cb(theme)
      })
    },
    current: () => ipcRenderer.invoke('theme:current'),
    themeSetting: () => ipcRenderer.invoke('theme:themeSetting'),
    set: (themeSetting: TThemeSetting) => ipcRenderer.invoke('theme:set', themeSetting)
  },
  storage: {
    getRelayGroups: () => ipcRenderer.invoke('storage:getRelayGroups'),
    setRelayGroups: (relayGroups: TRelayGroup[]) =>
      ipcRenderer.invoke('storage:setRelayGroups', relayGroups)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
