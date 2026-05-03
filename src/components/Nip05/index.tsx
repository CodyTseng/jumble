import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { useFetchNip05 } from '@/hooks/useFetchNip05'
import { toNoteList } from '@/lib/link'
import { SecondaryPageLink } from '@/PageManager'
import { BadgeAlert, BadgeCheck, ShieldCheck } from 'lucide-react'
import { Favicon } from '../Favicon'

export default function Nip05({ pubkey, append }: { pubkey: string; append?: string }) {
  const { profile } = useFetchProfile(pubkey)
  const { nip05IsVerified, nip05Name, nip05Domain, isNamecoin, isFetching } = useFetchNip05(
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
      className="flex items-center gap-1 truncate [&_svg]:size-3.5! [&_svg]:shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {nip05Name !== '_' ? (
        <span className="truncate text-sm text-muted-foreground">@{nip05Name}</span>
      ) : null}
      {nip05IsVerified ? (
        isNamecoin ? (
          <ShieldCheck className="shrink-0 text-teal-500" />
        ) : (
          <Favicon
            domain={nip05Domain}
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            fallback={<BadgeCheck className="shrink-0 text-primary" />}
          />
        )
      ) : (
        <BadgeAlert className="shrink-0 text-muted-foreground" />
      )}
      <SecondaryPageLink
        to={toNoteList({ domain: nip05Domain })}
        className={`truncate text-sm hover:underline ${nip05IsVerified ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {nip05Domain}
      </SecondaryPageLink>
      {append && <span className="truncate text-sm text-muted-foreground">{append}</span>}
    </div>
  )
}
