export { isNamecoinIdentifier, parseNamecoinIdentifier, resolveNamecoin } from './resolver'
export type { ParsedNamecoinIdentifier, NamecoinNostrResult, NameShowResult } from './types'
export { DEFAULT_ELECTRUMX_SERVERS, NAME_EXPIRE_DEPTH } from './constants'
export {
  ElectrumxClient,
  closeAllElectrumxClients,
  getElectrumxClient,
  nameShowWithFallback,
  nameShowWs,
  wsRpcBatch
} from './electrumx-ws'
