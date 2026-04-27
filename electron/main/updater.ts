import { app, BrowserWindow, Notification } from 'electron'
import electronUpdater, { UpdateInfo } from 'electron-updater'
import { IPC_CHANNELS, TUpdateState } from '../shared/ipc-types.js'

const { autoUpdater } = electronUpdater

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const FIRST_CHECK_DELAY_MS = 5_000

export class Updater {
  private window: BrowserWindow | null = null
  private state: TUpdateState
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly enabled: boolean) {
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion(),
      supported: enabled
    }

    if (!enabled) return

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => {
      this.update({ status: 'checking', error: undefined })
    })
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.update({
        status: 'available',
        newVersion: info.version,
        releaseNotes:
          typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
      })
    })
    autoUpdater.on('update-not-available', () => {
      this.update({ status: 'not-available' })
    })
    autoUpdater.on('download-progress', (p) => {
      this.update({
        status: 'downloading',
        progressPercent: Math.round(p.percent),
        bytesPerSecond: Math.round(p.bytesPerSecond)
      })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.update({
        status: 'downloaded',
        newVersion: info.version,
        progressPercent: 100
      })
      this.notifyDownloaded(info.version)
    })
    autoUpdater.on('error', (err) => {
      this.update({ status: 'error', error: err?.message ?? String(err) })
    })
  }

  attachWindow(win: BrowserWindow) {
    this.window = win
  }

  start() {
    if (!this.enabled) return
    setTimeout(() => this.check().catch(() => undefined), FIRST_CHECK_DELAY_MS)
    this.timer = setInterval(() => this.check().catch(() => undefined), CHECK_INTERVAL_MS)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  getState(): TUpdateState {
    return this.state
  }

  async check(): Promise<TUpdateState> {
    if (!this.enabled) return this.state
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.update({
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
    }
    return this.state
  }

  async download(): Promise<void> {
    if (!this.enabled) return
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      this.update({
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  async install(): Promise<void> {
    if (!this.enabled) return
    autoUpdater.quitAndInstall()
  }

  private update(patch: Partial<TUpdateState>) {
    this.state = { ...this.state, ...patch }
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.updateState, this.state)
    }
  }

  private notifyDownloaded(version: string) {
    if (!Notification.isSupported()) return
    try {
      new Notification({
        title: 'Jumble update ready',
        body: `Version ${version} will be installed the next time you quit Jumble.`
      }).show()
    } catch {
      // ignore
    }
  }
}
