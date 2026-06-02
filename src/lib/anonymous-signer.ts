import { NsecSigner } from '@/providers/NostrProvider/nsec.signer'
import { generateSecretKey } from 'nostr-tools'

export type TAnonymousSigner = {
  signer: NsecSigner
  pubkey: string
}

export function createAnonymousSigner(): TAnonymousSigner {
  const privkey = generateSecretKey()
  const signer = new NsecSigner()
  const pubkey = signer.login(privkey)
  return { signer, pubkey }
}
