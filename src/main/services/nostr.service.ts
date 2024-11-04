import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { app, ipcMain, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { getPublicKey, nip19, Event, finalizeEvent } from 'nostr-tools'
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

  private async login(nsec: string) {
    if (!safeStorage.isEncryptionAvailable()) {
      return
    }
    try {
      const { type, data } = nip19.decode(nsec)
      if (type !== 'nsec') {
        return
      }

      this.privkey = data
      const encryptedPrivateKey = safeStorage.encryptString(bytesToHex(data))
      writeFileSync(this.keyPath, encryptedPrivateKey)

      this.pubkey = getPublicKey(data)

      return this.pubkey
    } catch (error) {
      console.error(error)
      return
    }
  }

  private logout() {
    rmSync(this.keyPath)
    this.privkey = null
    this.pubkey = null
  }

  private signEvent(rawEvent: Omit<Event, 'id' | 'pubkey' | 'sig'>) {
    if (!this.privkey) {
      return null
    }

    try {
      return finalizeEvent(rawEvent, this.privkey)
    } catch (error) {
      console.error(error)
      return null
    }
  }
}
