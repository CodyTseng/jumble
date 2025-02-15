import { Invoice } from '@getalby/lightning-tools'

export function getAmountFromInvoice(invoice: string): number {
  const _invoice = new Invoice({ pr: invoice }) // TODO: need to validate
  return _invoice.satoshi
}

export function formatAmount(amount: number) {
  if (amount < 1000) return amount
  if (amount < 1000000) return `${Math.round(amount / 100) / 10}k`
  return `${Math.round(amount / 100000) / 10}M`
}
