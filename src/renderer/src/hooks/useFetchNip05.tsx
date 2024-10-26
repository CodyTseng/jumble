import { verifyNip05 } from '@renderer/lib/nip05'
import { useEffect, useState } from 'react'

export function useFetchNip05(nip05?: string, pubkey?: string) {
  const [nip05IsVerified, setNip05IsVerified] = useState(false)
  const [nip05Name, setNip05Name] = useState<string>('')
  const [nip05Domain, setNip05Domain] = useState<string>('')

  useEffect(() => {
    if (!nip05 || !pubkey) return
    verifyNip05(nip05, pubkey).then(({ isVerified, nip05Name, nip05Domain }) => {
      setNip05IsVerified(isVerified)
      setNip05Name(nip05Name)
      setNip05Domain(nip05Domain)
    })
  }, [nip05, pubkey])

  return { nip05IsVerified, nip05Name, nip05Domain }
}
