import { TProfile } from '@/types'
import { init, launchPaymentModal } from '@getalby/bitcoin-connect'
import { bech32 } from '@scure/base'
import { makeZapRequest } from 'nostr-tools/nip57'
import { utf8Decoder } from 'nostr-tools/utils'
import client from './client.service'

class LightningService {
  static instance: LightningService

  constructor() {
    if (!LightningService.instance) {
      LightningService.instance = this
      init({
        appName: 'Jumble',
        showBalance: false
      })
    }
    return LightningService.instance
  }

  async makeInvoice(pubkey: string, sats: number, comment: string, eventId?: string) {
    if (!client.signer) {
      throw new Error('You need to be logged in to zap')
    }

    const [profile, relayList] = await Promise.all([
      client.fetchProfile(pubkey),
      client.fetchRelayList(pubkey)
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
      profile: pubkey,
      event: eventId ?? null,
      amount,
      relays: relayList.read.concat(client.getDefaultRelayUrls()).slice(0, 5),
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
    const invoice = zapRequestResBody.pr
    if (!invoice) {
      throw new Error('Failed to create invoice')
    }
    return invoice
  }

  async zap(invoice: string) {
    return new Promise<boolean>((resolve) => {
      launchPaymentModal({
        invoice,
        onPaid: () => resolve(true),
        onCancelled: () => resolve(false)
      })
    })
  }

  private async getZapEndpoint(profile: TProfile): Promise<null | {
    callback: string
    lnurl: string
  }> {
    try {
      let lnurl: string = ''
      const { lud06, lud16 } = profile
      if (lud06) {
        const { words } = bech32.decode(lud06, 1000)
        const data = bech32.fromWords(words)
        lnurl = utf8Decoder.decode(data)
      } else if (lud16) {
        const [name, domain] = lud16.split('@')
        lnurl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString()
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
