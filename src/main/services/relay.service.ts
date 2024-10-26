import { ipcMain } from 'electron'
import { Filter } from 'nostr-tools'
import { Pool } from '@codytseng/simple-nostr'

export class RelayService {
  private pool: Pool

  constructor() {
    this.pool = new Pool(['ws://localhost:4869'])
  }

  async init() {
    ipcMain.handle('relay:fetchEvents', (_, filters: Filter[]) => this.fetchEvents(filters))

    await this.pool.init()
  }

  async fetchEvents(filters: Filter[]) {
    return this.pool.fetchEvents(filters)
  }
}
