import { app, BrowserWindow, Notification } from 'electron'
import electronUpdater, { UpdateInfo } from 'electron-updater'
import fs from 'node:fs'
import path from 'node:path'
import { IPC_CHANNELS, TUpdateState } from '../shared/ipc-types.js'

const { autoUpdater } = electronUpdater

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const FIRST_CHECK_DELAY_MS = 5_000
const SETTINGS_FILE = 'updater-settings.json'

type TUpdaterSettings = {
  autoUpdateEnabled: boolean
}

export class Updater {
  private window: BrowserWindow | null = null
  private state: TUpdateState
  private timer: NodeJS.Timeout | null = null
  private firstCheckTimer: NodeJS.Timeout | null = null
  private autoUpdateEnabled: boolean

  constructor(private readonly enabled: boolean) {
    this.autoUpdateEnabled = this.loadSettings().autoUpdateEnabled
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion(),
      supported: enabled,
      autoUpdateEnabled: this.autoUpdateEnabled
    }

    if (!enabled) return

    autoUpdater.autoDownload = this.autoUpdateEnabled
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
    if (!this.autoUpdateEnabled) return
    this.scheduleBackgroundChecks()
  }

  stop() {
    if (this.firstCheckTimer) clearTimeout(this.firstCheckTimer)
    this.firstCheckTimer = null
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

  setAutoUpdate(enabled: boolean): TUpdateState {
    if (this.autoUpdateEnabled === enabled) return this.state
    this.autoUpdateEnabled = enabled
    this.saveSettings({ autoUpdateEnabled: enabled })

    if (this.enabled) {
      autoUpdater.autoDownload = enabled
      if (enabled) {
        this.scheduleBackgroundChecks()
      } else {
        this.stop()
      }
    }

    this.update({ autoUpdateEnabled: enabled })
    return this.state
  }

  private scheduleBackgroundChecks() {
    this.stop()
    this.firstCheckTimer = setTimeout(
      () => this.check().catch(() => undefined),
      FIRST_CHECK_DELAY_MS
    )
    this.timer = setInterval(() => this.check().catch(() => undefined), CHECK_INTERVAL_MS)
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

  private settingsPath(): string {
    return path.join(app.getPath('userData'), SETTINGS_FILE)
  }

  private loadSettings(): TUpdaterSettings {
    try {
      const raw = fs.readFileSync(this.settingsPath(), 'utf8')
      const parsed = JSON.parse(raw) as Partial<TUpdaterSettings>
      if (typeof parsed?.autoUpdateEnabled === 'boolean') {
        return { autoUpdateEnabled: parsed.autoUpdateEnabled }
      }
    } catch {
      // missing or unreadable — fall through to default
    }
    return { autoUpdateEnabled: true }
  }

  private saveSettings(settings: TUpdaterSettings) {
    try {
      fs.writeFileSync(this.settingsPath(), JSON.stringify(settings), 'utf8')
    } catch (err) {
      console.error('[updater] failed to persist settings:', err)
    }
  }
}
