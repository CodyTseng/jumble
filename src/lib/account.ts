import { TSimpleAccount } from '@/types'

export function isSameAccount(a: TSimpleAccount | null, b: TSimpleAccount | null) {
  return a?.pubkey === b?.pubkey && a?.signerType === b?.signerType
}
