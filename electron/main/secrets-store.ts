import { app, safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TSecretsBundle } from '../shared/ipc-types.js'

const FILE_NAME = 'secrets.enc'

export class SecretsStore {
  private filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor() {
    this.filePath = path.join(app.getPath('userData'), FILE_NAME)
  }

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  async load(): Promise<TSecretsBundle> {
    let buf: Buffer
    try {
      buf = await fs.readFile(this.filePath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw err
    }
    if (buf.length === 0) return {}
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage not available — cannot decrypt secrets')
    }
    const text = safeStorage.decryptString(buf)
    if (!text) return {}
    try {
      const parsed = JSON.parse(text)
      return parsed && typeof parsed === 'object' ? (parsed as TSecretsBundle) : {}
    } catch {
      return {}
    }
  }

  // Serialize writes so concurrent saves don't trample each other.
  save(bundle: TSecretsBundle): Promise<void> {
    const next = this.writeChain.then(() => this.writeNow(bundle))
    this.writeChain = next.catch(() => {
      // swallow so chain stays alive
    })
    return next
  }

  private async writeNow(bundle: TSecretsBundle): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage not available — refusing to write secrets in plaintext')
    }
    const json = JSON.stringify(bundle ?? {})
    const cipher = safeStorage.encryptString(json)
    const tmp = `${this.filePath}.tmp`
    await fs.writeFile(tmp, cipher, { mode: 0o600 })
    await fs.rename(tmp, this.filePath)
  }
}
