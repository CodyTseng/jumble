import { TProfile } from '@/types'
import {
  init,
  launchPaymentModal,
  onConnected,
  onDisconnected
} from '@getalby/bitcoin-connect-react'
import { Invoice } from '@getalby/lightning-tools'
import { bech32 } from '@scure/base'
import { WebLNProvider } from '@webbtc/webln-types'
import { makeZapRequest } from 'nostr-tools/nip57'
import { utf8Decoder } from 'nostr-tools/utils'
import client from './client.service'

class LightningService {
  static instance: LightningService
  private provider: WebLNProvider | null = null

  constructor() {
    if (!LightningService.instance) {
      LightningService.instance = this
      init({
        appName: 'Jumble',
        showBalance: false
      })
      onConnected((provider) => {
        this.provider = provider
      })
      onDisconnected(() => {
        this.provider = null
      })
    }
    return LightningService.instance
  }

  async zap(
    receipt: string,
    sats: number,
    comment: string,
    eventId?: string,
    sender?: string | null,
    closeOuterModel?: () => void
  ): Promise<{ preimage: string; invoice: string }> {
    if (!client.signer) {
      throw new Error('You need to be logged in to zap')
    }

    const [profile, receiptRelayList, senderRelayList] = await Promise.all([
      client.fetchProfile(receipt),
      client.fetchRelayList(receipt),
      sender ? client.fetchRelayList(sender) : Promise.resolve({ read: [], write: [] })
    ])
    if (!profile) {
      throw new Error('Recipient not found')
    }
    const zapEndpoint = await this.getZapEndpoint(profile)
    if (!zapEndpoint) {
      throw new Error("Recipient's lightning address is invalid")
    }
    const { callback, lnurl } = zapEndpoint
    const amount = sats * 1000
    const zapRequestDraft = makeZapRequest({
      profile: receipt,
      event: eventId ?? null,
      amount,
      relays: receiptRelayList.read
        .slice(0, 3)
        .concat(senderRelayList.write.slice(0, 3))
        .concat(client.getCurrentRelayUrls().slice(0, 2)),
      comment
    })
    const zapRequest = await client.signer(zapRequestDraft)
    const zapRequestRes = await fetch(
      `${callback}?amount=${amount}&nostr=${encodeURI(JSON.stringify(zapRequest))}&lnurl=${lnurl}`
    )
    const zapRequestResBody = await zapRequestRes.json()
    if (zapRequestResBody.error) {
      throw new Error(zapRequestResBody.error)
    }
    const { pr, verify } = zapRequestResBody
    if (!pr) {
      throw new Error('Failed to create invoice')
    }

    if (this.provider) {
      const { preimage } = await this.provider.sendPayment(pr)
      closeOuterModel?.()
      return { preimage, invoice: pr }
    }

    return new Promise((resolve) => {
      closeOuterModel?.()
      const { setPaid } = launchPaymentModal({
        invoice: pr,
        onPaid: (response) => {
          clearInterval(checkPaymentInterval)
          resolve({ preimage: response.preimage, invoice: pr })
        },
        onCancelled: () => {
          clearInterval(checkPaymentInterval)
        }
      })

      const checkPaymentInterval = setInterval(async () => {
        const invoice = new Invoice({ pr, verify })
        const paid = await invoice.verifyPayment()

        if (paid && invoice.preimage) {
          setPaid({
            preimage: invoice.preimage
          })
        }
      }, 1000)

      // TODO:
      if (!verify) {
        setPaid({ preimage: '' })
      }
    })
  }

  private async getZapEndpoint(profile: TProfile): Promise<null | {
    callback: string
    lnurl: string
  }> {
    try {
      let lnurl: string = ''

      // Some clients have incorrectly filled in the positions for lud06 and lud16
      const { lud06: a, lud16: b } = profile
      let lud16: string | undefined
      let lud06: string | undefined
      if (b && b.includes('@')) {
        lud16 = b
      } else if (a && a.includes('@')) {
        lud16 = a
      } else if (a && a.startsWith('lnurl')) {
        lud06 = a
      } else if (b && b.startsWith('lnurl')) {
        lud06 = b
      }

      if (lud16) {
        const [name, domain] = lud16.split('@')
        lnurl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString()
      } else if (lud06) {
        const { words } = bech32.decode(lud06, 1000)
        const data = bech32.fromWords(words)
        lnurl = utf8Decoder.decode(data)
      } else {
        return null
      }

      const res = await fetch(lnurl)
      const body = await res.json()

      if (body.allowsNostr && body.nostrPubkey) {
        return {
          callback: body.callback,
          lnurl
        }
      }
    } catch (err) {
      console.error(err)
    }

    return null
  }
}

const instance = new LightningService()
export default instance
