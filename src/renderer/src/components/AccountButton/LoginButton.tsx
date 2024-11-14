import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { useToast } from '@renderer/hooks'
import { IS_ELECTRON } from '@renderer/lib/env'
import { useNostr } from '@renderer/providers/NostrProvider'
import { LogIn } from 'lucide-react'
import { useState } from 'react'

export default function LoginButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar'
}) {
  const { toast } = useToast()
  const { canLogin, login, nip07Login } = useNostr()
  const [open, setOpen] = useState(false)
  const [nsec, setNsec] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNsec(e.target.value)
    setErrMsg(null)
  }

  const handleLogin = () => {
    if (nsec === '') return

    login(nsec).catch((err) => {
      setErrMsg(err.message)
    })
  }

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

  if (IS_ELECTRON) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={variant} size={variant}>
            {triggerComponent}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-80">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            {!canLogin && (
              <DialogDescription className="text-destructive">
                Encryption is not available in your device.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-1">
            <Input
              type="password"
              placeholder="nsec1.."
              value={nsec}
              onChange={handleInputChange}
              className={errMsg ? 'border-destructive' : ''}
              disabled={!canLogin}
            />
            {errMsg && <div className="text-xs text-destructive pl-3">{errMsg}</div>}
          </div>
          <Button onClick={handleLogin} disabled={!canLogin}>
            Login
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Button
      disabled={!canLogin}
      variant={variant}
      size={variant}
      onClick={(e) => {
        e.stopPropagation()
        nip07Login().catch((err) => {
          toast({
            title: 'Failed to login',
            description: err.message,
            variant: 'destructive'
          })
        })
      }}
    >
      {triggerComponent}
    </Button>
  )
}
