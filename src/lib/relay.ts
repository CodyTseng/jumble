import storage from '@/services/local-storage.service'
import { TRelayInfo } from '@/types'

const RELAY_DISCONNECT_REASONS = new Set([
  'closed by caller',
  'relay connection errored',
  'relay connection failed',
  'relay connection timed out',
  'relay connection closed',
  'pingpong timed out',
  'relay connection closed by us'
])

export function getDefaultRelayUrls() {
  return storage.getDefaultRelayUrls()
}

export function getSearchRelayUrls() {
  return storage.getSearchRelayUrls()
}

export function mergeRelayUrls(...relayGroups: [string[], ...string[][]]): string[]
export function mergeRelayUrls(limit: number, ...relayGroups: string[][]): string[]
export function mergeRelayUrls(
  limitOrRelayGroup: number | string[],
  ...remainingRelayGroups: string[][]
) {
  const limit = typeof limitOrRelayGroup === 'number' ? limitOrRelayGroup : undefined
  const relayGroups =
    typeof limitOrRelayGroup === 'number'
      ? remainingRelayGroups
      : [limitOrRelayGroup, ...remainingRelayGroups]
  const merged = Array.from(new Set(relayGroups.flat()))
  return limit === undefined ? merged : merged.slice(0, limit)
}

export function checkAlgoRelay(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.software === 'https://github.com/bitvora/algo-relay' // hardcode for now
}

export function checkSearchRelay(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.supported_nips?.includes(50)
}

export function checkNip43Support(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.supported_nips?.includes(43) && !!(relayInfo.self || relayInfo.pubkey)
}

export function isRelayDisconnectReason(reason: string) {
  return RELAY_DISCONNECT_REASONS.has(reason)
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
