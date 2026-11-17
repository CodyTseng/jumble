import { TAccount, TAccountPointer } from '@/types'

export function isSameAccount(a: TAccountPointer | null, b: TAccountPointer | null) {
  return a?.pubkey === b?.pubkey && a?.signerType === b?.signerType
}

/** Saved-login migration only; an explicit successful login always replaces it. */
export function getAccountMigrationPriority(account: TAccount) {
  switch (account.signerType) {
    case 'nip-07':
      return 6
    case 'bunker':
      return account.bunker && account.bunkerClientSecretKey ? 5 : 0
    case 'ncryptsec':
      return account.ncryptsec ? 4 : 0
    case 'nsec':
    case 'browser-nsec':
      return account.nsec ? 3 : 0
    case 'nip-55':
      return account.signerPackageName ? 2 : 0
    case 'npub':
      return account.npub ? 1 : 0
    default:
      return 0
  }
}
