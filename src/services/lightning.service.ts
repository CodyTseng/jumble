import { CODY_PUBKEY, JUMBLE_PUBKEY } from '@/constants'
import { getEventAuthorPubkey } from '@/lib/event'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import { getDefaultRelayUrls } from '@/lib/relay'
import { TProfile } from '@/types'
import { init, launchPaymentModal } from '@getalby/bitcoin-connect-react'
import { Invoice } from '@getalby/lightning-tools'
import { bech32 } from '@scure/base'
import DataLoader from 'dataloader'
import { WebLNProvider } from '@webbtc/webln-types'
import dayjs from 'dayjs'
import { Filter, kinds, NostrEvent } from 'nostr-tools'
import { SubCloser } from 'nostr-tools/abstract-pool'
import { makeZapRequest } from 'nostr-tools/nip57'
import { utf8Decoder } from 'nostr-tools/utils'
import client from './client.service'

export type TRecentSupporter = {
  pubkey: string
  amount: number
  comment?: string
  createdAt: number
}

const OFFICIAL_PUBKEYS = [JUMBLE_PUBKEY, CODY_PUBKEY]

class LightningService {
  static instance: LightningService
  provider: WebLNProvider | null = null
  private recentSupportersCache: TRecentSupporter[] | null = null
  private nostrPubkeyLoader = new DataLoader<string, string | null>(
    async (recipientPubkeys) => {
      const results = await Promise.allSettled(
        recipientPubkeys.map((pubkey) => this.fetchRecipientNostrPubkey(pubkey))
      )
      return results.map((res) => (res.status === 'fulfilled' ? res.value : null))
    },
    { maxBatchSize: 1 }
  )

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

  async zap(
    sender: string,
    recipientOrEvent: string | NostrEvent,
    sats: number,
    comment: string,
    closeOuterModel?: () => void
  ): Promise<{ preimage: string; invoice: string } | null> {
    if (!client.signer) {
      throw new Error('You need to be logged in to zap')
    }
    const { recipient, event } =
      typeof recipientOrEvent === 'string'
        ? { recipient: recipientOrEvent }
        : {
            recipient: getEventAuthorPubkey(recipientOrEvent),
            event: recipientOrEvent
          }

    const [profile, receiptRelayList, senderRelayList] = await Promise.all([
      client.fetchProfile(recipient),
      client.fetchRelayList(recipient),
      sender
        ? client.fetchRelayList(sender)
        : Promise.resolve({ read: getDefaultRelayUrls(), write: getDefaultRelayUrls() })
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
    const zapTargetEvent =
      event?.pubkey === recipient ? event : event && { ...event, pubkey: recipient }
    const zapRequestDraft = makeZapRequest({
      ...(zapTargetEvent ? { event: zapTargetEvent } : { pubkey: recipient }),
      amount,
      relays: receiptRelayList.read
        .slice(0, 4)
        .concat(senderRelayList.write.slice(0, 3))
        .concat(getDefaultRelayUrls()),
      comment
    })
    const zapRequest = await client.signer.signEvent(zapRequestDraft)

    const zapRequestUrl = new URL(callback)
    zapRequestUrl.searchParams.append('amount', amount.toString())
    zapRequestUrl.searchParams.append('nostr', JSON.stringify(zapRequest))
    zapRequestUrl.searchParams.append('lnurl', lnurl)

    const zapRequestRes = await fetch(zapRequestUrl.toString())
    const zapRequestResBody = await zapRequestRes.json()
    if (zapRequestResBody.error) {
      throw new Error(zapRequestResBody.message)
    }
    const { pr, verify, reason } = zapRequestResBody
    if (!pr) {
      throw new Error(reason ?? 'Failed to create invoice')
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
          resolve(null)
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
        if (event) {
          filter['#e'] = [event.id]
        }
        subCloser = client.subscribe(
          senderRelayList.write.concat(getDefaultRelayUrls()).slice(0, 4),
          filter,
          {
            onevent: (evt) => {
              const info = getZapInfoFromEvent(evt)
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

  async payInvoice(
    invoice: string,
    closeOuterModel?: () => void
  ): Promise<{ preimage: string; invoice: string } | null> {
    if (this.provider) {
      const { preimage } = await this.provider.sendPayment(invoice)
      closeOuterModel?.()
      return { preimage, invoice: invoice }
    }

    return new Promise((resolve) => {
      closeOuterModel?.()
      launchPaymentModal({
        invoice: invoice,
        onPaid: (response) => {
          resolve({ preimage: response.preimage, invoice: invoice })
        },
        onCancelled: () => {
          resolve(null)
        }
      })
    })
  }

  invalidateRecentSupportersCache() {
    this.recentSupportersCache = null
  }

  async fetchRecentSupporters(force = false) {
    if (!force && this.recentSupportersCache) {
      return this.recentSupportersCache
    }
    const relayList = await client.fetchRelayList(CODY_PUBKEY)
    const events = await client.fetchEvents(relayList.read.slice(0, 4), {
      kinds: [kinds.Zap],
      '#p': OFFICIAL_PUBKEYS,
      since: dayjs().subtract(1, 'month').unix()
    })
    events.sort((a, b) => b.created_at - a.created_at)
    const validations = await Promise.all(events.map((event) => this.validateZapReceipt(event)))
    const map = new Map<string, TRecentSupporter>()
    events.forEach((event, index) => {
      if (!validations[index]) return
      const info = getZapInfoFromEvent(event)
      if (!info || !info.senderPubkey || OFFICIAL_PUBKEYS.includes(info.senderPubkey)) return

      const { amount, comment, senderPubkey } = info
      const item = map.get(senderPubkey)
      if (!item) {
        map.set(senderPubkey, {
          pubkey: senderPubkey,
          amount,
          comment,
          createdAt: event.created_at
        })
      } else {
        item.amount += amount
        if (!item.comment && comment) item.comment = comment
      }
    })
    this.recentSupportersCache = Array.from(map.values())
      .filter((item) => item.amount >= 1000)
      .sort((a, b) => b.amount - a.amount)
    return this.recentSupportersCache
  }

  /**
   * Validates a zap receipt (kind 9735) to ensure it represents a real payment.
   *
   * Two checks are performed:
   * 1. Issuer check (NIP-57): the receipt must be signed by the `nostrPubkey`
   *    advertised by the recipient's LNURL pay endpoint. This rejects forged
   *    receipts. When the endpoint or its `nostrPubkey` can't be resolved, the
   *    receipt is accepted leniently — we can't prove it forged.
   * 2. Preimage check: when the receipt carries a `preimage` tag, `sha256(preimage)`
   *    must equal the bolt11 payment hash. The tag is optional in NIP-57, so its
   *    absence is not treated as invalid.
   */
  async validateZapReceipt(receipt: NostrEvent): Promise<boolean> {
    const info = getZapInfoFromEvent(receipt)
    if (!info || !info.recipientPubkey || !info.invoice) return false

    if (info.preimage) {
      try {
        const invoice = new Invoice({ pr: info.invoice })
        if (!invoice.validatePreimage(info.preimage)) return false
      } catch {
        return false
      }
    }

    const nostrPubkey = await this.nostrPubkeyLoader.load(info.recipientPubkey)
    if (!nostrPubkey) return true
    return receipt.pubkey === nostrPubkey
  }

  private async fetchRecipientNostrPubkey(recipientPubkey: string): Promise<string | null> {
    const profile = await client.fetchProfile(recipientPubkey)
    if (!profile) return null
    const endpoint = await this.getZapEndpoint(profile)
    return endpoint?.nostrPubkey ?? null
  }

  private async getZapEndpoint(profile: TProfile): Promise<null | {
    callback: string
    lnurl: string
    nostrPubkey?: string
  }> {
    try {
      let lnurl: string = ''

      // Some clients have incorrectly filled in the positions for lud06 and lud16
      if (!profile.lightningAddress) {
        console.warn('Profile has no lightning address', profile)
        return null
      }

      if (profile.lightningAddress.includes('@')) {
        const [name, domain] = profile.lightningAddress.split('@')
        lnurl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString()
      } else {
        const { words } = bech32.decode(profile.lightningAddress as any, 1000)
        const data = bech32.fromWords(words)
        lnurl = utf8Decoder.decode(data)
      }

      const res = await fetch(lnurl)
      const body = await res.json()

      if (body.allowsNostr !== false && body.callback) {
        return {
          callback: body.callback,
          lnurl,
          nostrPubkey: typeof body.nostrPubkey === 'string' ? body.nostrPubkey : undefined
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
