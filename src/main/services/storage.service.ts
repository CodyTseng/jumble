import { TConfig, TRelayGroup, TThemeSetting } from '@common/types'
import { app, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

export class StorageService {
  private storage: Storage

  constructor() {
    this.storage = new Storage()
  }

  init() {
    ipcMain.handle('storage:getRelayGroups', () => this.getRelayGroups())
    ipcMain.handle('storage:setRelayGroups', (_, relayGroups: TRelayGroup[]) =>
      this.setRelayGroups(relayGroups)
    )
  }

  getRelayGroups(): TRelayGroup[] | null {
    return this.storage.get('relayGroups') ?? null
  }

  setRelayGroups(relayGroups: TRelayGroup[]) {
    this.storage.set('relayGroups', relayGroups)
  }

  getTheme() {
    return this.storage.get('theme') ?? 'system'
  }

  setTheme(theme: TThemeSetting) {
    this.storage.set('theme', theme)
  }
}

class Storage {
  private path: string
  private config: TConfig
  private writeTimer: NodeJS.Timeout | null = null

  constructor() {
    this.path = path.join(app.getPath('userData'), 'config.json')
    this.checkConfigFile(this.path)
    const json = readFileSync(this.path, 'utf-8')
    this.config = JSON.parse(json)
  }

  get<K extends keyof TConfig, V extends TConfig[K]>(key: K): V | undefined {
    return this.config[key] as V
  }

  set<K extends keyof TConfig>(key: K, value: TConfig[K]) {
    this.config[key] = value
    if (this.writeTimer) return

    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      writeFileSync(this.path, JSON.stringify(this.config))
    }, 1000)
  }

  private checkConfigFile(path: string) {
    try {
      if (!existsSync(path)) {
        writeFileSync(path, '{}')
      }
    } catch (err) {
      console.error(err)
    }
  }
}
