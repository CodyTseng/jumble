import { useEffect, useState } from 'react'

export function useFetchNip05(nip05?: string, pubkey?: string) {
  const [nip05IsVerified, setNip05IsVerified] = useState(false)
  const [nip05Name, nip05Domain] = nip05?.split('@') || [undefined, undefined]

  useEffect(() => {
    const verifyNip05 = async () => {
      if (!nip05Name || !nip05Domain || !pubkey) return
      try {
        const res = await fetch(`https://${nip05Domain}/.well-known/nostr.json?name=${nip05Name}`)
        const json = await res.json()
        if (json.names?.[nip05Name] === pubkey) {
          setNip05IsVerified(true)
        }
      } catch {
        // ignore
      }
    }
    verifyNip05()
  }, [nip05, pubkey])

  return { nip05IsVerified, nip05Name, nip05Domain }
}
