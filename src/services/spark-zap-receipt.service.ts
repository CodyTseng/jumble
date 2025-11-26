import { BIG_RELAY_URLS } from '@/constants'
import { kinds, NostrEvent } from 'nostr-tools'
import { Payment } from '@breeztech/breez-sdk-spark/web'

/**
 * SparkZapReceiptService - Publishes NIP-57 zap receipts for incoming Spark payments
 *
 * Since Breez Spark SDK doesn't automatically publish zap receipts to Nostr,
 * we need to manually create and publish kind 9735 events when we receive
 * payments to our Lightning address.
 *
 * IMPORTANT NOTE (2025-10-11):
 * This service is fully implemented and ready to publish zap receipts, BUT
 * Breez Lightning addresses (@breez.tips) currently do NOT support receiving zaps
 * due to missing NIP-57 metadata in their LNURL response.
 *
 * The LNURL endpoint is missing:
 * - allowsNostr: true
 * - nostrPubkey: <hex-pubkey>
 *
 * This causes NIP-57 compliant wallets to reject zap attempts with
 * "invalid lightning address" error.
 *
 * Regular Lightning payments work fine. The callback endpoint accepts zap requests.
 * Once Breez adds NIP-57 support, this service will automatically start working.
 *
 * Feature request submitted to Breez SDK team.
 */
class SparkZapReceiptService {
  private static instance: SparkZapReceiptService

  constructor() {
    if (!SparkZapReceiptService.instance) {
      SparkZapReceiptService.instance = this
    }
    return SparkZapReceiptService.instance
  }

  /**
   * Publish a zap receipt (kind 9735) to Nostr relays
   *
   * @param payment - The payment received from Spark SDK
   * @param publish - Function to publish the zap receipt event
   */
  async publishZapReceipt(
    payment: Payment,
    publish: (event: any) => Promise<NostrEvent>
  ): Promise<void> {
    try {
      console.log('[SparkZapReceipt] Publishing zap receipt for payment:', payment.id)

      // Extract bolt11 invoice from payment
      const bolt11 = this.extractBolt11FromPayment(payment)
      if (!bolt11) {
        console.warn('[SparkZapReceipt] No bolt11 invoice found in payment')
        console.warn('[SparkZapReceipt] Payment details type:', payment.details?.type)
        return
      }

      // Try to extract and parse zap request from payment description
      const zapRequest = this.extractZapRequestFromPayment(payment)
      if (!zapRequest) {
        console.warn('[SparkZapReceipt] No zap request found in payment description')
        console.warn('[SparkZapReceipt] This might be a regular invoice payment, not a zap')
        if (payment.details?.type === 'lightning') {
          console.warn('[SparkZapReceipt] Description preview:', payment.details.description?.substring(0, 100))
        }
        return
      }

      console.log('[SparkZapReceipt] Zap request found:', {
        sender: zapRequest.pubkey,
        amount: payment.amount,
        comment: zapRequest.content
      })

      // Build zap receipt event (kind 9735)
      const zapReceipt = this.buildZapReceipt(payment, zapRequest, bolt11)

      // Publish to relays
      console.log('[SparkZapReceipt] Publishing to relays...')
      const publishedEvent = await publish(zapReceipt)

      console.log('[SparkZapReceipt] ✅ Zap receipt published:', publishedEvent.id)
    } catch (error) {
      console.error('[SparkZapReceipt] Failed to publish zap receipt:', error)
      // Don't throw - zap receipts are nice-to-have but not critical
    }
  }

  /**
   * Extract bolt11 invoice from Spark payment
   */
  private extractBolt11FromPayment(payment: Payment): string | null {
    // For Lightning payments, bolt11 is in details.invoice
    if (payment.details && payment.details.type === 'lightning') {
      return payment.details.invoice || null
    }

    return null
  }

  /**
   * Extract and parse zap request from payment description
   *
   * NIP-57 zap flow includes the zap request (kind 9734) in the invoice description
   */
  private extractZapRequestFromPayment(payment: Payment): NostrEvent | null {
    try {
      // For Lightning payments, description is in details.description
      let description: string | undefined

      if (payment.details && payment.details.type === 'lightning') {
        description = payment.details.description
      }

      if (!description) {
        return null
      }

      // Try to parse as JSON
      const zapRequest = JSON.parse(description)

      // Validate it's a proper zap request (kind 9734)
      if (
        zapRequest.kind === 9734 &&
        zapRequest.pubkey &&
        zapRequest.tags &&
        zapRequest.sig
      ) {
        return zapRequest as NostrEvent
      }

      return null
    } catch (error) {
      // Not a valid zap request
      return null
    }
  }

  /**
   * Build a NIP-57 compliant zap receipt event (kind 9735)
   */
  private buildZapReceipt(
    payment: Payment,
    zapRequest: NostrEvent,
    bolt11: string
  ): Record<string, any> {
    const tags: string[][] = [
      ['bolt11', bolt11],
      ['description', JSON.stringify(zapRequest)],
      ['p', zapRequest.pubkey] // Sender (zapper)
    ]

    // Add preimage if available
    const preimage = payment.details?.type === 'lightning' ? payment.details.preimage : undefined
    if (preimage) {
      tags.push(['preimage', preimage])
    }

    // Add recipient pubkey (P tag) - this should be our own pubkey
    // Get from zapRequest tags
    const recipientTag = zapRequest.tags.find((t) => t[0] === 'p')
    if (recipientTag && recipientTag[1]) {
      tags.push(['P', recipientTag[1]]) // Recipient (zappee)
    }

    // Copy event tags from zap request (e tag for zapped note, a tag for zapped article)
    zapRequest.tags.forEach((tag) => {
      if (tag[0] === 'e' || tag[0] === 'a') {
        tags.push(tag)
      }
    })

    // Copy relay hints from zap request
    const relaysTag = zapRequest.tags.find((t) => t[0] === 'relays')
    if (relaysTag) {
      tags.push(relaysTag)
    } else {
      // Use default relays if not specified
      tags.push(['relays', ...BIG_RELAY_URLS.slice(0, 3)])
    }

    return {
      kind: kinds.Zap, // 9735
      content: '', // Zap receipts have empty content
      tags,
      created_at: payment.timestamp || Math.floor(Date.now() / 1000)
    }
  }

  /**
   * Check if a payment is a zap (has zap request in description)
   */
  isZapPayment(payment: Payment): boolean {
    return this.extractZapRequestFromPayment(payment) !== null
  }
}

const instance = new SparkZapReceiptService()
export default instance
