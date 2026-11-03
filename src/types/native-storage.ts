/** Platform-neutral contracts implemented by desktop and mobile secure stores. */
export type TSecretsBundle = {
  nsec?: Record<string, string>
  ncryptsec?: Record<string, string>
  bunkerClientSecretKey?: Record<string, string>
  encryptionKeyPrivkey?: Record<string, string>
  retiredEncryptionKeyPrivkey?: Record<string, { privkey: string; retiredAt: number }[]>
}

export type TSecretsBridge = {
  isAvailable: () => Promise<boolean>
  load: () => Promise<TSecretsBundle>
  save: (bundle: TSecretsBundle) => Promise<void>
}

export type TLocalStorageSnapshot = {
  version: 1
  revision: number
  entries: Record<string, string>
}

export type TLocalStorageBridge = {
  load: () => Promise<TLocalStorageSnapshot | null>
  save: (snapshot: TLocalStorageSnapshot) => Promise<void>
}

export type TNativeStorageBridge = {
  secrets: TSecretsBridge
  localStorage: TLocalStorageBridge
}
