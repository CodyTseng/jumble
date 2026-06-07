import { verifyNip05 } from '@/lib/nip05'
import { useEffect, useState } from 'react'

export function useFetchNip05(nip05?: string, pubkey?: string) {
  const [nip05IsVerified, setNip05IsVerified] = useState(false)
  const [nip05Name, setNip05Name] = useState<string>('')
  const [nip05Domain, setNip05Domain] = useState<string>('')
  const [isNamecoin, setIsNamecoin] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    if (!nip05 || !pubkey) {
      setIsFetching(false)
      return
    }
    verifyNip05(nip05, pubkey).then((result) => {
      setNip05IsVerified(result.isVerified)
      setNip05Name(result.nip05Name)
      setNip05Domain(result.nip05Domain)
      setIsNamecoin(result.isNamecoin ?? false)
      setIsFetching(false)
    })
  }, [nip05, pubkey])

  return { nip05IsVerified, nip05Name, nip05Domain, isNamecoin, isFetching }
}
