import { TDraftEvent } from '@common/types'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { app, ipcMain, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { Event, finalizeEvent, getPublicKey, nip19 } from 'nostr-tools'
import { join } from 'path'

export class NostrService {
  private keyPath: string
  private privkey: Uint8Array | null = null
  private pubkey: string | null = null

  constructor() {
    this.keyPath = join(app.getPath('userData'), 'private-key')
  }

  init() {
    if (existsSync(this.keyPath)) {
      const data = readFileSync(this.keyPath)
      const privateKey = safeStorage.decryptString(data)
      this.privkey = hexToBytes(privateKey)
      this.pubkey = getPublicKey(this.privkey)
    }

    ipcMain.handle('nostr:login', (_, nsec: string) => this.login(nsec))
    ipcMain.handle('nostr:logout', () => this.logout())
    ipcMain.handle('nostr:getPublicKey', () => this.pubkey)
    ipcMain.handle('nostr:signEvent', (_, event: Omit<Event, 'id' | 'pubkey' | 'sig'>) =>
      this.signEvent(event)
    )
  }

  private async login(nsec: string): Promise<{
    pubkey?: string
    reason?: string
  }> {
    try {
      const { type, data } = nip19.decode(nsec)
      if (type !== 'nsec') {
        return {
          reason: 'invalid nsec'
        }
      }

      this.privkey = data
      const encryptedPrivateKey = safeStorage.encryptString(bytesToHex(data))
      writeFileSync(this.keyPath, encryptedPrivateKey)

      this.pubkey = getPublicKey(data)

      return {
        pubkey: this.pubkey
      }
    } catch (error) {
      console.error(error)
      return {
        reason: error instanceof Error ? error.message : 'invalid nesc'
      }
    }
  }

  private logout() {
    rmSync(this.keyPath)
    this.privkey = null
    this.pubkey = null
  }

  private signEvent(draftEvent: TDraftEvent) {
    if (!this.privkey) {
      return null
    }

    try {
      return finalizeEvent(draftEvent, this.privkey)
    } catch (error) {
      console.error(error)
      return null
    }
  }
}
