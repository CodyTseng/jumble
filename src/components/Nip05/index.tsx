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
    <div className="flex items-center gap-1 truncate" onClick={(e) => e.stopPropagation()}>
      {nip05Name !== '_' ? (
        <span className="text-sm text-muted-foreground truncate">@{nip05Name}</span>
      ) : null}
      <SecondaryPageLink
        to={toNoteList({ domain: nip05Domain })}
        className={`flex items-center gap-1 hover:underline truncate [&_svg]:size-3.5 [&_svg]:shrink-0 ${nip05IsVerified ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {nip05IsVerified ? <BadgeCheck /> : <BadgeAlert />}
        <span className="text-sm truncate">{nip05Domain}</span>
      </SecondaryPageLink>
      <Favicon domain={nip05Domain} className="w-3.5 h-3.5" />
      {append && <span className="text-sm text-muted-foreground truncate">{append}</span>}
    </div>
  )
}
