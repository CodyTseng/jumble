import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { Zap } from 'lucide-react'
import { useState } from 'react'
import ZapDialog from '../ZapDialog'

export default function ProfileZapButton({ pubkey }: { pubkey: string }) {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="rounded-full"
        onClick={() => checkLogin(() => setOpen(true))}
      >
        <Zap className="text-yellow-400" />
      </Button>
      <ZapDialog open={open} setOpen={setOpen} pubkey={pubkey} />
    </>
  )
}
