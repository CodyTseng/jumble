import 'websocket-polyfill'

import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { useWebSocketImplementation as setWebSocketImpl } from 'nostr-tools/relay'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import WebSocket from 'ws'
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc.js'
import { RelayManager } from './relay-manager.js'
import { SecretsStore } from './secrets-store.js'
import { Updater } from './updater.js'
import { attachWindowStatePersistence, loadWindowState } from './window-state.js'

// Inject Node's ws so nostr-tools uses it instead of global WebSocket
setWebSocketImpl(WebSocket)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// vite-plugin-electron injects these at build time
// MAIN_DIST = dist-electron, RENDERER_DIST = dist
process.env.APP_ROOT = path.join(__dirname, '..', '..')
const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null
const manager = new RelayManager()
const secrets = new SecretsStore()
// Auto-update is only meaningful for packaged builds — in dev the binary
// is not what would actually be replaced.
const updater = new Updater(app.isPackaged)

function createWindow() {
  const savedState = loadWindowState()
  win = new BrowserWindow({
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height,
    minWidth: 480,
    minHeight: 480,
    title: 'Jumble',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#171717' : '#ffffff',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => {
    if (savedState.isMaximized) {
      win?.maximize()
    }
    win?.show()
  })

  attachWindowStatePersistence(win)
  manager.attachWindow(win)
  updater.attachWindow(win)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(() => {
  registerIpcHandlers(manager, secrets, updater)
  createWindow()
  updater.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    manager.shutdown()
    updater.stop()
    unregisterIpcHandlers()
    app.quit()
  }
})

app.on('before-quit', () => {
  manager.shutdown()
  updater.stop()
})
