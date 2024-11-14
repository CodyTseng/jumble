import { useNostr } from '@renderer/providers/NostrProvider'
import LoginButton from './LoginButton'
import ProfileButton from './ProfileButton'

export default function AccountButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar'
}) {
  const { pubkey } = useNostr()

  if (pubkey) {
    return <ProfileButton variant={variant} pubkey={pubkey} />
  } else {
    return <LoginButton variant={variant} />
  }
}
