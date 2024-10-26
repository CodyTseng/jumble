import { useFetchNip05 } from '@renderer/hooks/useFetchNip05'
import { BadgeAlert, BadgeCheck } from 'lucide-react'

export default function Nip05({ nip05, pubkey }: { nip05: string; pubkey: string }) {
  const { nip05IsVerified, nip05Name, nip05Domain } = useFetchNip05(nip05, pubkey)
  return (
    <div className="flex items-center space-x-1">
      {nip05Name !== '_' ? (
        <div className="text-sm text-muted-foreground truncate">@{nip05Name}</div>
      ) : null}
      <a
        href={`https://${nip05Domain}`}
        target="_blank"
        className={`flex items-center space-x-1 hover:underline ${nip05IsVerified ? 'text-highlight' : 'text-muted-foreground'}`}
        rel="noreferrer"
      >
        {nip05IsVerified ? <BadgeCheck size={16} /> : <BadgeAlert size={16} />}
        <div className="text-sm">{nip05Domain}</div>
      </a>
    </div>
  )
}
