import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { LogIn } from 'lucide-react'

export default function LoginButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar' | 'small-screen-titlebar'
}) {
  const { checkLogin } = useNostr()

  let triggerComponent: React.ReactNode
  if (variant === 'titlebar' || variant === 'small-screen-titlebar') {
    triggerComponent = <LogIn />
  } else {
    triggerComponent = (
      <>
        <LogIn size={16} />
        <div>Login</div>
      </>
    )
  }

  return (
    <Button variant={variant} size={variant} onClick={() => checkLogin()}>
      {triggerComponent}
    </Button>
  )
}
