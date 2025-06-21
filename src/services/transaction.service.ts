import { JUMBLE_API_BASE_URL } from '@/constants'

class TransactionService {
  static instance: TransactionService

  constructor() {
    if (!TransactionService.instance) {
      TransactionService.instance = this
    }
    return TransactionService.instance
  }

  async createTransaction(
    pubkey: string,
    amount: number
  ): Promise<{
    transactionId: string
    invoiceId: string
  }> {
    const url = new URL('/v1/transactions', JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pubkey,
        amount,
        purpose: 'translation'
      })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to create transaction')
    }
    return data
  }

  async checkTransaction(transactionId: string): Promise<{
    state: 'pending' | 'failed' | 'settled'
  }> {
    const url = new URL(`/v1/transactions/${transactionId}/check`, JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST'
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to complete transaction')
    }
    return data
  }
}

const instance = new TransactionService()
export default instance
