import storage from '@/services/local-storage.service'
import { TRelayInfo } from '@/types'

export function getDefaultRelayUrls() {
  return storage.getDefaultRelayUrls()
}

export function checkAlgoRelay(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.software === 'https://github.com/bitvora/algo-relay' // hardcode for now
}

export function checkSearchRelay(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.supported_nips?.includes(50)
}

export function checkNip43Support(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.supported_nips?.includes(43) && !!relayInfo.pubkey
}

export function filterOutBigRelays(relayUrls: string[]) {
  const defaultRelays = getDefaultRelayUrls()
  return relayUrls.filter((url) => !defaultRelays.includes(url))
}

export function recommendRelaysByLanguage(i18nLanguage: string) {
  if (i18nLanguage.startsWith('zh')) {
    return [
      'wss://relay.nostrzh.org/',
      'wss://relay.nostr.moe/',
      'wss://lang.relays.land/zh',
      'wss://relay.stream/'
    ]
  }
  if (i18nLanguage.startsWith('ja')) {
    return ['wss://yabu.me/', 'wss://lang.relays.land/ja']
  }
  if (i18nLanguage.startsWith('es')) {
    return ['wss://lang.relays.land/es']
  }
  if (i18nLanguage.startsWith('it')) {
    return ['wss://lang.relays.land/it']
  }
  if (i18nLanguage.startsWith('pt')) {
    return ['wss://lang.relays.land/pt']
  }
  return []
}
