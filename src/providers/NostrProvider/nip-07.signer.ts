import { pubkeyToNpub } from '@/lib/pubkey'
import { withSignerApproval } from '@/lib/signer-approval'
import { ISigner, TDraftEvent, TNip07 } from '@/types'
import { verifyEvent } from 'nostr-tools'

// A silent getPublicKey answer returns in milliseconds; anything slower means
// the extension showed a prompt and we should stop proactive checks.
export const NIP07_PROMPT_THRESHOLD_MS = 1_000

// nos2x-family providers (nostrame included) cache the pubkey on the injected
// page object and never invalidate it when the active account changes in the
// extension, so getPublicKey() keeps returning the old account until a page
// reload. Clearing the cache forces a fresh query to the extension background.
export function clearNip07ProviderCache(signer: TNip07) {
  if ('_pubkey' in signer) {
    try {
      ;(signer as { _pubkey?: string | null })._pubkey = null
    } catch {
      // frozen provider object; nothing we can do
    }
  }
}

export class Nip07Signer implements ISigner {
  private signer: TNip07 | undefined
  private pubkey: string | null = null
  private extensionPrompts = false
  private activeAccountCheck: Promise<void> | null = null

  async init(expectedPubkey?: string) {
    const checkInterval = 100
    const maxAttempts = 50

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (window.nostr) {
        this.signer = window.nostr
        if (expectedPubkey) {
          this.pubkey = expectedPubkey
        }
        return
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }

    throw new Error(
      'You need to install a nostr signer extension to login. Such as alby, nostr-keyx or nos2x.'
    )
  }

  async getPublicKey() {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.pubkey) {
      clearNip07ProviderCache(this.signer)
      this.pubkey = await this.signer.getPublicKey()
    }
    return this.pubkey
  }

  // Multi-account extensions (e.g. nostrame) encrypt and decrypt with
  // whichever account is currently active in the extension, which may not be
  // the account this signer was bound to. Verify before every operation so we
  // never use the wrong key. Single-account extensions always return the same
  // pubkey, so this check is transparent for them.
  private ensureActiveAccount(signer: TNip07): Promise<void> {
    if (!this.pubkey || this.extensionPrompts) {
      return Promise.resolve()
    }
    // Concurrent operations (e.g. decrypting several private lists right
    // after login) share a single check so prompting extensions show at most
    // one dialog.
    if (!this.activeAccountCheck) {
      this.activeAccountCheck = this.checkActiveAccount(signer).finally(() => {
        this.activeAccountCheck = null
      })
    }
    return this.activeAccountCheck
  }

  private async checkActiveAccount(signer: TNip07) {
    clearNip07ProviderCache(signer)
    const startedAt = Date.now()
    let activePubkey: string
    try {
      activePubkey = await signer.getPublicKey()
    } catch {
      // A rejection means the extension showed a prompt the user dismissed.
      // Re-checking would spam prompts, so let the extension's own
      // per-operation prompt be the account guard instead of blocking the
      // operation.
      this.extensionPrompts = true
      return
    }
    // The extension prompts on every getPublicKey call; checking again would
    // spam the user, so trust the extension's own per-account prompt instead.
    if (Date.now() - startedAt > NIP07_PROMPT_THRESHOLD_MS) {
      this.extensionPrompts = true
    }
    if (activePubkey !== this.pubkey) {
      throw new Error(
        `Your signer extension is currently on a different account. Please switch it to ${pubkeyToNpub(this.pubkey!)} and try again, or log out if this account is no longer in your extension.`
      )
    }
  }

  async signEvent(draftEvent: TDraftEvent) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    // Some multi-account extensions (e.g. nostrame) honor a `pubkey` field in
    // the template and sign with that account even when another one is active.
    // Extensions using nostr-tools' finalizeEvent overwrite the field, so it
    // is safe to send either way; the checks below discard wrong results.
    const draft = this.pubkey ? ({ ...draftEvent, pubkey: this.pubkey } as TDraftEvent) : draftEvent
    let event
    try {
      event = await withSignerApproval(this.signer.signEvent(draft))
    } catch (err) {
      // A strict extension may reject the non-standard pubkey field. Retry
      // with a spec-shaped template, but never after a user denial (that
      // would show a second approval prompt).
      const message = err instanceof Error ? err.message : String(err)
      if (draft === draftEvent || /denied|reject|cancel/i.test(message)) {
        throw err
      }
      event = await withSignerApproval(this.signer.signEvent(draftEvent))
    }
    if (event && this.pubkey && event.pubkey !== this.pubkey) {
      throw new Error(
        `Your signer extension signed with a different account. Please switch it to ${pubkeyToNpub(this.pubkey)} and try again.`
      )
    }
    if (event && !verifyEvent(event)) {
      throw new Error('Your signer extension returned an invalid signature')
    }
    return event
  }

  async nip04Encrypt(pubkey: string, plainText: string) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.signer.nip04?.encrypt) {
      throw new Error('The extension you are using does not support nip04 encryption')
    }
    await this.ensureActiveAccount(this.signer)
    return await this.signer.nip04.encrypt(pubkey, plainText)
  }

  async nip04Decrypt(pubkey: string, cipherText: string) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.signer.nip04?.decrypt) {
      throw new Error('The extension you are using does not support nip04 decryption')
    }
    await this.ensureActiveAccount(this.signer)
    return await this.signer.nip04.decrypt(pubkey, cipherText)
  }

  async nip44Encrypt(pubkey: string, plainText: string) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.signer.nip44?.encrypt) {
      throw new Error('The extension you are using does not support nip44 encryption')
    }
    await this.ensureActiveAccount(this.signer)
    return await this.signer.nip44.encrypt(pubkey, plainText)
  }

  async nip44Decrypt(pubkey: string, cipherText: string) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.signer.nip44?.decrypt) {
      throw new Error('The extension you are using does not support nip44 decryption')
    }
    await this.ensureActiveAccount(this.signer)
    return await this.signer.nip44.decrypt(pubkey, cipherText)
  }
}
