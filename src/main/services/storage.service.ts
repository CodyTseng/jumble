import { TConfig, TRelayGroup } from '@common/types'
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

  getRelayGroups(): TRelayGroup[] {
    return (
      this.storage.get('relayGroups') ?? [
        {
          groupName: 'Global',
          relayUrls: ['wss://relay.damus.io/', 'wss://nos.lol/'],
          isActive: true
        }
      ]
    )
  }

  setRelayGroups(relayGroups: TRelayGroup[]) {
    this.storage.set('relayGroups', relayGroups)
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

  get<K extends keyof TConfig>(key: string): TConfig[K] | undefined {
    return this.config[key]
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