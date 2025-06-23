import { JUMBLE_API_BASE_URL } from '@/constants'
import client from '@/services/client.service'
import { TTranslationAccount } from '@/types'

class TranslationService {
  static instance: TranslationService

  private apiKeyMap: Record<string, string | undefined> = {}
  private currentPubkey: string | null = null

  constructor() {
    if (!TranslationService.instance) {
      TranslationService.instance = this
    }
    return TranslationService.instance
  }

  async getAccount(): Promise<TTranslationAccount> {
    if (!this.currentPubkey) {
      throw new Error('Please login first')
    }
    const apiKey = this.apiKeyMap[this.currentPubkey]
    const path = '/v1/translation/account'
    const method = 'GET'
    let auth: string | undefined
    if (!apiKey) {
      auth = await client.signHttpAuth(
        new URL(path, JUMBLE_API_BASE_URL).toString(),
        method,
        'Auth to get Jumble translation service account'
      )
    }
    const act = await this._fetch<TTranslationAccount>({
      path,
      method,
      auth,
      retryWhenUnauthorized: !auth
    })

    if (act.api_key && act.pubkey) {
      this.apiKeyMap[act.pubkey] = act.api_key
    }

    return act
  }

  async regenerateApiKey(): Promise<string> {
    try {
      const data = await this._fetch({
        path: '/v1/translation/regenerate-api-key',
        method: 'POST'
      })
      if (data.api_key && this.currentPubkey) {
        this.apiKeyMap[this.currentPubkey] = data.api_key
      }
      return data.api_key
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : ''
      throw new Error(errMsg || 'Failed to regenerate API key')
    }
  }

  async translate(text: string, target: string): Promise<string | undefined> {
    try {
      const data = await this._fetch({
        path: '/v1/translation/translate',
        method: 'POST',
        body: JSON.stringify({ q: text, target })
      })
      return data.translatedText
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : ''
      throw new Error(errMsg || 'Failed to translate')
    }
  }

  changeCurrentPubkey(pubkey: string | null): void {
    this.currentPubkey = pubkey
  }

  private async _fetch<T = any>({
    path,
    method,
    body,
    auth,
    retryWhenUnauthorized = true
  }: {
    path: string
    method: string
    body?: string
    auth?: string
    retryWhenUnauthorized?: boolean
  }): Promise<T> {
    if (!this.currentPubkey) {
      throw new Error('Please login first')
    }
    const apiKey = this.apiKeyMap[this.currentPubkey]
    const hasApiKey = !!apiKey
    let _auth: string
    if (auth) {
      _auth = auth
    } else if (hasApiKey) {
      _auth = `Bearer ${apiKey}`
    } else {
      const act = await this.getAccount()
      _auth = `Bearer ${act.api_key}`
    }

    const url = new URL(path, JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: _auth },
      body
    })

    const data = await response.json()
    if (!response.ok) {
      if (data.code === '00403' && hasApiKey && retryWhenUnauthorized) {
        this.apiKeyMap[this.currentPubkey] = undefined
        return this._fetch({ path, method, body, retryWhenUnauthorized: false })
      }
      throw new Error(data.error)
    }
    return data
  }
}

const instance = new TranslationService()
export default instance
