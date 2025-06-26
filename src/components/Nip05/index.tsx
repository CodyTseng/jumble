import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { useFetchNip05 } from '@/hooks/useFetchNip05'
import { BadgeAlert, BadgeCheck } from 'lucide-react'
import { useState } from 'react'

export default function Nip05({ pubkey, append }: { pubkey: string; append?: string }) {
  const { profile } = useFetchProfile(pubkey)
  const { nip05IsVerified, nip05Name, nip05Domain, isFetching } = useFetchNip05(
    profile?.nip05,
    pubkey
  )

  if (isFetching) {
    return (
      <div className="flex items-center py-1">
        <Skeleton className="h-3 w-16" />
      </div>
    )
  }

  if (!profile?.nip05 || !nip05Name || !nip05Domain) return null

  return (
    <div className="flex items-center gap-1 truncate" onClick={(e) => e.stopPropagation()}>
      {nip05Name !== '_' ? (
        <span className="text-sm text-muted-foreground truncate">@{nip05Name}</span>
      ) : null}
      <a
        href={`https://${nip05Domain}`}
        target="_blank"
        className={`flex items-center gap-1 hover:underline truncate [&_svg]:size-3.5 [&_svg]:shrink-0 ${nip05IsVerified ? 'text-primary' : 'text-muted-foreground'}`}
        rel="noreferrer"
      >
        {nip05IsVerified ? <BadgeCheck /> : <BadgeAlert />}
        <span className="text-sm truncate">{nip05Domain}</span>
      </a>
      <Favicon domain={nip05Domain} />
      {append && <span className="text-sm text-muted-foreground truncate">{append}</span>}
    </div>
  )
}

function Favicon({ domain }: { domain: string }) {
  const [error, setError] = useState(false)
  if (error) return null

  return (
    <img
      src={`https://${domain}/favicon.ico`}
      alt={domain}
      className="w-3.5 h-3.5"
      onError={() => setError(true)}
    />
  )
}
