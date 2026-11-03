import { copyText } from '@/lib/native-system'
import { formatNpub } from '@/lib/pubkey'
import { Check, Copy } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'

export default function PubkeyCopy({ pubkey }: { pubkey: string }) {
  const npub = useMemo(() => (pubkey ? nip19.npubEncode(pubkey) : ''), [pubkey])
  const [copied, setCopied] = useState(false)

  const copyNpub = () => {
    if (!npub) return

    copyText(npub)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="clickable bg-muted text-muted-foreground flex w-fit items-center gap-2 rounded-full px-2 text-sm"
      onClick={() => copyNpub()}
    >
      <div>{formatNpub(npub, 24)}</div>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </div>
  )
}
