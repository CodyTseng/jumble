import { LRUCache } from 'lru-cache'

type TVerifyNip05Result = {
  isVerified: boolean
  nip05Name: string
  nip05Domain: string
}

const verifyNip05ResultCache = new LRUCache<string, TVerifyNip05Result>({
  max: 1000,
  fetchMethod: (key) => {
    const { nip05, pubkey } = JSON.parse(key)
    return _verifyNip05(nip05, pubkey)
  }
})

async function _verifyNip05(nip05: string, pubkey: string): Promise<TVerifyNip05Result> {
  const [nip05Name, nip05Domain] = nip05?.split('@') || [undefined, undefined]
  const result = { isVerified: false, nip05Name, nip05Domain }
  if (!nip05Name || !nip05Domain || !pubkey) return result

  try {
    const res = await fetch(`https://${nip05Domain}/.well-known/nostr.json?name=${nip05Name}`)
    const json = await res.json()
    if (json.names?.[nip05Name] === pubkey) {
      return { ...result, isVerified: true }
    }
  } catch {
    // ignore
  }
  return result
}

export async function verifyNip05(nip05: string, pubkey: string): Promise<TVerifyNip05Result> {
  const result = await verifyNip05ResultCache.fetch(JSON.stringify({ nip05, pubkey }))
  if (result) {
    return result
  }
  const [nip05Name, nip05Domain] = nip05?.split('@') || [undefined, undefined]
  return { isVerified: false, nip05Name, nip05Domain }
}
