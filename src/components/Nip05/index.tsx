import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { useFetchNip05 } from '@/hooks/useFetchNip05'
import { BadgeAlert, BadgeCheck } from 'lucide-react'

export default function Nip05({ pubkey }: { pubkey: string }) {
  const { profile } = useFetchProfile(pubkey)
  const { nip05IsVerified, nip05Name, nip05Domain, isFetching } = useFetchNip05(
    profile?.nip05,
    pubkey
  )

  if (isFetching) {
    return (
      <div className="flex items-center py-1">
        <Skeleton className="h-3 w-20" />
      </div>
    )
  }

  if (!profile?.nip05) return null

  return (
    nip05Name &&
    nip05Domain && (
      <div className="flex items-center space-x-1 truncate">
        {nip05Name !== '_' ? (
          <div className="text-sm text-muted-foreground truncate">@{nip05Name}</div>
        ) : null}
        <a
          href={`https://${nip05Domain}`}
          target="_blank"
          className={`flex items-center space-x-1 hover:underline truncate ${nip05IsVerified ? 'text-primary' : 'text-muted-foreground'}`}
          rel="noreferrer"
        >
          {nip05IsVerified ? <BadgeCheck className="size-4" /> : <BadgeAlert className="size-4" />}
          <div className="text-sm truncate">{nip05Domain}</div>
        </a>
      </div>
    )
  )
}
