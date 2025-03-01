import { BIG_RELAY_URLS } from '@/constants'
import { extractZapInfoFromReceipt } from '@/lib/event'
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
import dayjs from 'dayjs'
import { Filter, kinds } from 'nostr-tools'
import { SubCloser } from 'nostr-tools/abstract-pool'
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
    sender: string,
    recipient: string,
    sats: number,
    comment: string,
    eventId?: string,
    closeOuterModel?: () => void
  ): Promise<{ preimage: string; invoice: string }> {
    if (!client.signer) {
      throw new Error('You need to be logged in to zap')
    }

    const [profile, receiptRelayList, senderRelayList] = await Promise.all([
      client.fetchProfile(recipient, true),
      client.fetchRelayList(recipient),
      sender
        ? client.fetchRelayList(sender)
        : Promise.resolve({ read: BIG_RELAY_URLS, write: BIG_RELAY_URLS })
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
      profile: recipient,
      event: eventId ?? null,
      amount,
      relays: receiptRelayList.read
        .slice(0, 4)
        .concat(senderRelayList.write.slice(0, 3))
        .concat(BIG_RELAY_URLS),
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
      let checkPaymentInterval: ReturnType<typeof setInterval> | undefined
      let subCloser: SubCloser | undefined
      const { setPaid } = launchPaymentModal({
        invoice: pr,
        onPaid: (response) => {
          clearInterval(checkPaymentInterval)
          subCloser?.close()
          resolve({ preimage: response.preimage, invoice: pr })
        },
        onCancelled: () => {
          clearInterval(checkPaymentInterval)
          subCloser?.close()
        }
      })

      if (verify) {
        checkPaymentInterval = setInterval(async () => {
          const invoice = new Invoice({ pr, verify })
          const paid = await invoice.verifyPayment()

          if (paid && invoice.preimage) {
            setPaid({
              preimage: invoice.preimage
            })
          }
        }, 1000)
      } else {
        const filter: Filter = {
          kinds: [kinds.Zap],
          '#p': [recipient],
          since: dayjs().subtract(1, 'minute').unix()
        }
        if (eventId) {
          filter['#e'] = [eventId]
        }
        subCloser = client.subscribe(
          senderRelayList.write.concat(BIG_RELAY_URLS).slice(0, 4),
          filter,
          {
            onevent: (evt) => {
              const info = extractZapInfoFromReceipt(evt)
              if (!info) return

              if (info.invoice === pr) {
                setPaid({ preimage: info.preimage ?? '' })
              }
            }
          }
        )
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
      if (!profile.lightningAddress) {
        return null
      }

      if (profile.lightningAddress.includes('@')) {
        const [name, domain] = profile.lightningAddress.split('@')
        lnurl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString()
      } else {
        const { words } = bech32.decode(profile.lightningAddress, 1000)
        const data = bech32.fromWords(words)
        lnurl = utf8Decoder.decode(data)
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
