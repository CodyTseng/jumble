import { useFetchProfile } from '@renderer/hooks'
import Username from '../Username'

export function EmbeddedMention({ userId }: { userId: string }) {
  const { pubkey } = useFetchProfile(userId)
  if (!pubkey) return null

  return <Username userId={pubkey} showAt className="text-highlight font-normal" />
}
