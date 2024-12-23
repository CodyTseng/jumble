import { TAccountPointer } from '@/types'

export function isSameAccount(a: TAccountPointer | null, b: TAccountPointer | null) {
  return a?.pubkey === b?.pubkey && a?.signerType === b?.signerType
}
