import { BIG_RELAY_URLS } from '@/constants'
import { TRelayInfo } from '@/types'

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
  return relayUrls.filter((url) => !BIG_RELAY_URLS.includes(url))
}
