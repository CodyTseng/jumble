import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import { Filter } from 'nostr-tools'

// Custom APIs for renderer
const api = {
  theme: {
    onChange: (cb: (theme: 'dark' | 'light') => void) => {
      ipcRenderer.on('theme:change', (_, theme) => {
        cb(theme)
      })
    },
    current: () => ipcRenderer.invoke('theme:current')
  },
  relay: {
    fetchEvents: (filters: Filter[]) => ipcRenderer.invoke('relay:fetchEvents', filters)
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
