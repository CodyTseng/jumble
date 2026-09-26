import 'websocket-polyfill'

import {
  app,
  BrowserWindow,
  nativeTheme,
  net,
  protocol,
  safeStorage,
  session,
  shell
} from 'electron'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc.js'
import { MediaServer } from './media-server.js'
import { PasswordCrypto } from './password-crypto.js'
import { PomegranateAuthServer } from './pomegranate-auth-server.js'
import { RelayManager } from './relay-manager.js'
import { isRendererFrameUrl } from './renderer-frame.js'
import { RendererStorageStore } from './renderer-storage-store.js'
import { SecretsStore } from './secrets-store.js'
import { MigratingStoreCrypto, SafeStorageCrypto } from './store-crypto.js'
import { ElectronSystemNotificationService } from './system-notification.js'
import { Updater } from './updater.js'
import { attachWindowStatePersistence, loadWindowState } from './window-state.js'

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

// The SPA in production is served from a custom `app://renderer/` origin so
// localStorage / IndexedDB partitions remain stable across launches. Must be
// declared before app.whenReady() — registerSchemesAsPrivileged has to run
// during the renderer-process registration phase.
//   standard:true        — gives the scheme a parseable origin (host = `renderer`)
//   secure:true          — renderer treated as a secure context (crypto.subtle, etc.)
//   supportFetchAPI/corsEnabled — fetch() works against app:// resources
//   stream:true          — protocol.handle responses can be streamed
const APP_SCHEME = 'app'
const APP_HOST = 'renderer'
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

let win: BrowserWindow | null = null
const gotSingleInstanceLock = app.requestSingleInstanceLock()
const manager = new RelayManager()
// The encryption backend for the on-disk stores is chosen at startup:
// safeStorage when the OS keychain is usable, otherwise a password-derived
// key (see password-crypto.ts). A machine that already has password-encrypted
// stores keeps the password backend even if safeStorage later becomes
// available, so existing data stays readable.
const passwordCrypto = new PasswordCrypto(app.getPath('userData'))
let secrets: SecretsStore | null = null
let rendererStorage: RendererStorageStore | null = null
// Auto-update is only meaningful for packaged builds — in dev the binary
// is not what would actually be replaced. Flatpak builds are updated by
// Flatpak/Flathub, so the app-level updater should stay disabled there.
const isFlatpak =
  process.env.FLATPAK_ID === 'com.codytseng.jumble' || process.env.container === 'flatpak'
const systemNotification = new ElectronSystemNotificationService()
const updater = new Updater(app.isPackaged && !isFlatpak, systemNotification)
// Tiny http://127.0.0.1 server that hosts the YouTube IFrame shim page so
// embedded YT players have an http(s) parent origin (the SPA itself runs on
// app://, which YT rejects with player error 153).
const mediaServer = new MediaServer()
const pomegranateAuthServer = new PomegranateAuthServer((url) => shell.openExternal(url))
let rendererOrigin: string | null = null

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
      sandbox: true
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
    win.loadURL(`${APP_ORIGIN}/`)
  }

  win.on('closed', () => {
    win = null
  })
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (req) => {
    const url = new URL(req.url)
    if (url.host !== APP_HOST) {
      return new Response('Not Found', { status: 404 })
    }
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    let filePath = path.normalize(path.join(RENDERER_DIST, pathname))
    const insideRoot = filePath === RENDERER_DIST || filePath.startsWith(RENDERER_DIST + path.sep)
    if (!insideRoot) {
      return new Response('Forbidden', { status: 403 })
    }
    let isFile = false
    try {
      isFile = existsSync(filePath) && statSync(filePath).isFile()
    } catch {
      isFile = false
    }
    // SPA fallback — any non-asset path serves index.html so client-side
    // routing survives reload / deep links.
    if (!isFile) {
      filePath = path.join(RENDERER_DIST, 'index.html')
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.whenReady().then(async () => {
    if (VITE_DEV_SERVER_URL) {
      rendererOrigin = new URL(VITE_DEV_SERVER_URL).origin
    } else {
      registerAppProtocol()
      rendererOrigin = APP_ORIGIN
    }

    const usePasswordBackend =
      (await passwordCrypto.hasParams()) || !safeStorage.isEncryptionAvailable()
    const storeCrypto = usePasswordBackend
      ? safeStorage.isEncryptionAvailable()
        ? // Existing files may still be safeStorage-encrypted; read both
          // formats and converge to password format on the next save.
          new MigratingStoreCrypto(passwordCrypto, new SafeStorageCrypto())
        : passwordCrypto
      : new SafeStorageCrypto()
    secrets = new SecretsStore(storeCrypto)
    rendererStorage = new RendererStorageStore(storeCrypto)

    // Start disk reads while Chromium creates the renderer. The renderer's
    // first IPC calls reuse these promises instead of beginning I/O afterward.
    // With the password backend the stores are still locked at this point; the
    // renderer gates its boot on the unlock screen and loads them afterwards.
    if (storeCrypto.isReady()) {
      void rendererStorage.preload().catch((error) => {
        console.error('Failed to preload renderer storage:', error)
      })
      void secrets.preload().catch((error) => {
        console.error('Failed to preload encrypted secrets:', error)
      })
    }

    // Bypass renderer-side CORS by injecting a permissive ACAO header on every
    // cross-origin response. Affects fetch/XHR as well as <video>/<img>/<audio>
    // since they share Chromium's network stack. Scope this to requests
    // initiated by the renderer itself (the SPA's own frame) — third-party
    // iframes (e.g. the YouTube shim and its YT child frames) make credentialed
    // XHRs where `ACAO: *` is rejected by spec.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (!isRendererFrameUrl(details.frame?.url, rendererOrigin)) {
        callback({})
        return
      }
      const headers = { ...(details.responseHeaders ?? {}) }
      delete headers['access-control-allow-origin']
      delete headers['Access-Control-Allow-Origin']
      headers['Access-Control-Allow-Origin'] = ['*']
      callback({ responseHeaders: headers })
    })

    registerIpcHandlers(
      manager,
      secrets,
      updater,
      mediaServer,
      pomegranateAuthServer,
      rendererStorage,
      {
        backend: usePasswordBackend ? 'password' : 'safeStorage',
        passwordCrypto,
        secrets,
        rendererStorage
      },
      systemNotification
    )
    createWindow()
    updater.start()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    manager.shutdown()
    updater.stop()
    mediaServer.stop()
    pomegranateAuthServer.stop()
    unregisterIpcHandlers()
    app.quit()
  }
})

app.on('before-quit', () => {
  if (app.isReady()) session.defaultSession.flushStorageData()
  void rendererStorage?.flush().catch((error) => {
    console.error('Failed to flush renderer storage snapshot:', error)
  })
  manager.shutdown()
  updater.stop()
  mediaServer.stop()
  pomegranateAuthServer.stop()
})

const requestGracefulQuit = () => {
  if (app.isReady()) session.defaultSession.flushStorageData()
  app.quit()
}

process.on('SIGINT', requestGracefulQuit)
process.on('SIGTERM', requestGracefulQuit)
