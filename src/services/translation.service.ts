import { JUMBLE_API_BASE_URL } from '@/constants'
import { TTranslationAccount } from '@/types'

type SignHttpAuth = (url: string, method: string, content?: string) => Promise<string>

class TranslationService {
  static instance: TranslationService

  constructor() {
    if (!TranslationService.instance) {
      TranslationService.instance = this
    }
    return TranslationService.instance
  }

  async getAccount(signHttpAuth: SignHttpAuth, api_key?: string): Promise<TTranslationAccount> {
    const url = new URL('/v1/translation/account', JUMBLE_API_BASE_URL).toString()

    let auth: string
    if (api_key) {
      auth = `Bearer ${api_key}`
    } else {
      auth = await signHttpAuth(url, 'get', 'Auth to get Jumble translation service account')
    }

    const response = await fetch(url, {
      headers: { Authorization: auth }
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to fetch account information')
    }
    return data
  }

  async regenerateApiKey(
    signHttpAuth: SignHttpAuth,
    api_key?: string
  ): Promise<string | undefined> {
    let auth: string
    if (!api_key) {
      const act = await this.getAccount(signHttpAuth)
      auth = `Bearer ${act.api_key}`
    } else {
      auth = `Bearer ${api_key}`
    }
    const url = new URL('/v1/translation/regenerate-api-key', JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth }
    })
    const data = await response.json()
    if (!response.ok) {
      if (data.code === '00403' && !!api_key) {
        return this.regenerateApiKey(signHttpAuth)
      }
      throw new Error(data.error ?? 'Failed to regenerate API key')
    }
    return data.api_key
  }

  async translate(
    text: string,
    target: string,
    signHttpAuth: SignHttpAuth,
    api_key?: string
  ): Promise<string | undefined> {
    let auth: string
    if (!api_key) {
      const act = await this.getAccount(signHttpAuth)
      auth = `Bearer ${act.api_key}`
    } else {
      auth = `Bearer ${api_key}`
    }
    const url = new URL('/v1/translation/translate', JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ q: text, target })
    })
    const data = await response.json()
    if (!response.ok) {
      if (data.code === '00403' && !!api_key) {
        return this.translate(text, target, signHttpAuth)
      }
      throw new Error(data.error ?? 'Failed to translate')
    }
    return data.translatedText
  }
}

const instance = new TranslationService()
export default instance
