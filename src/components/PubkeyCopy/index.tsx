import { formatNpub } from '@/lib/pubkey'
import { Check, Copy } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'

export default function PubkeyCopy({ pubkey }: { pubkey: string }) {
  const npub = useMemo(() => (pubkey ? nip19.npubEncode(pubkey) : ''), [pubkey])
  const [copied, setCopied] = useState(false)

  const copyNpub = () => {
    if (!npub) return

    navigator.clipboard.writeText(npub)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="flex gap-2 text-sm text-muted-foreground items-center bg-muted w-fit px-2 rounded-full clickable"
      onClick={() => copyNpub()}
    >
      <div>{formatNpub(npub, 24)}</div>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </div>
  )
}
