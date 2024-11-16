import { Button } from '@renderer/components/ui/button'
import { useNostr } from '@renderer/providers/NostrProvider'
import { LogIn } from 'lucide-react'

export default function LoginButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar'
}) {
  const { checkLogin } = useNostr()

  let triggerComponent: React.ReactNode
  if (variant === 'titlebar') {
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
