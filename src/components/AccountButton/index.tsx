import { useNostr } from '@/providers/NostrProvider'
import LoginButton from './LoginButton'
import ProfileButton from './ProfileButton'

export default function AccountButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar' | 'small-screen-titlebar'
}) {
  const { pubkey } = useNostr()

  if (pubkey) {
    return <ProfileButton variant={variant} />
  } else {
    return <LoginButton variant={variant} />
  }
}
