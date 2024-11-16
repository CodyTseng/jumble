import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { useNostr } from '@renderer/providers/NostrProvider'
import { Dispatch, useState } from 'react'

export default function LoginDialog({
  open,
  setOpen
}: {
  open: boolean
  setOpen: Dispatch<boolean>
}) {
  const { login, canLogin } = useNostr()
  const [nsec, setNsec] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNsec(e.target.value)
    setErrMsg(null)
  }

  const handleLogin = () => {
    if (nsec === '') return

    login(nsec)
      .then(() => setOpen(false))
      .catch((err) => {
        setErrMsg(err.message)
      })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-80">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription className="text-destructive">
            {!canLogin && 'Encryption is not available in your device.'}
          </DialogDescription>
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
