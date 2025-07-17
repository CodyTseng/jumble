import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { useFetchNip05 } from '@/hooks/useFetchNip05'
import { toNoteList } from '@/lib/link'
import { SecondaryPageLink } from '@/PageManager'
import { BadgeAlert, BadgeCheck } from 'lucide-react'
import { Favicon } from '../Favicon'

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
    <div
      className="flex items-center gap-1 truncate [&_svg]:!size-3.5 [&_svg]:shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {nip05Name !== '_' ? (
        <span className="text-sm text-muted-foreground truncate">@{nip05Name}</span>
      ) : null}
      {nip05IsVerified ? (
        <Favicon
          domain={nip05Domain}
          className="w-3.5 h-3.5 rounded-full"
          fallback={<BadgeCheck className="text-primary" />}
        />
      ) : (
        <BadgeAlert className="text-muted-foreground" />
      )}
      <SecondaryPageLink
        to={toNoteList({ domain: nip05Domain })}
        className={`hover:underline truncate text-sm ${nip05IsVerified ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {nip05Domain}
      </SecondaryPageLink>
      {append && <span className="text-sm text-muted-foreground truncate">{append}</span>}
    </div>
  )
}
