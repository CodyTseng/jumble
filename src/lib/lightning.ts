import { TProfile } from '@/types'
import { Invoice } from '@getalby/lightning-tools'
import { isEmail } from './utils'

export function getAmountFromInvoice(invoice: string): number {
  try {
    const _invoice = new Invoice({ pr: invoice })
    return _invoice.satoshi
  } catch (error) {
    console.error('Invalid Lightning invoice:', error)
    return 0
  }
}

export function getInvoiceDetails(invoice: string): { amount: number; description: string | null } {
  try {
    const _invoice = new Invoice({ pr: invoice })
    return {
      amount: _invoice.satoshi,
      description: _invoice.description
    }
  } catch (error) {
    console.error('Invalid Lightning invoice:', error)
    return {
      amount: 0,
      description: null
    }
  }
}

export function formatAmount(amount: number) {
  if (amount < 1000) return amount
  if (amount < 1000000) return `${Math.round(amount / 100) / 10}k`
  return `${Math.round(amount / 100000) / 10}M`
}

export function getLightningAddressFromProfile(profile: TProfile) {
  // Some clients have incorrectly filled in the positions for lud06 and lud16
  const { lud16: a, lud06: b } = profile
  let lud16: string | undefined
  let lud06: string | undefined

  if (a && isEmail(a)) {
    lud16 = a
  } else if (b && isEmail(b)) {
    lud16 = b
  } else if (b && b.startsWith('lnurl')) {
    lud06 = b
  } else if (a && a.startsWith('lnurl')) {
    lud06 = a
  }

  return lud16 || lud06 || undefined
}
