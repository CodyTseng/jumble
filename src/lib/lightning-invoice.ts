import { Invoice } from '@getalby/lightning-tools'

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
