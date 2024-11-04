import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Input } from '@renderer/components/ui/input'
import { useFetchProfile } from '@renderer/hooks'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { toProfile } from '@renderer/lib/url'
import { useSecondaryPage } from '@renderer/PageManager'
import { useAccount } from '@renderer/providers/AccountProvider'
import { LogIn } from 'lucide-react'
import { useState } from 'react'

export default function AccountButton() {
  const { pubkey } = useAccount()

  if (pubkey) {
    return <ProfileButton pubkey={pubkey} />
  } else {
    return <LoginButton />
  }
}

function ProfileButton({ pubkey }: { pubkey: string }) {
  const { logout } = useAccount()
  const { avatar } = useFetchProfile(pubkey)
  const { push } = useSecondaryPage()
  const defaultAvatar = generateImageByPubkey(pubkey)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative non-draggable">
        <Avatar className="w-6 h-6">
          <AvatarImage src={avatar} />
          <AvatarFallback>
            <img src={defaultAvatar} />
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 hover:bg-black opacity-0 hover:opacity-20 transition-opacity rounded-full" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => push(toProfile(pubkey))}>Profile</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LoginButton() {
  const { login } = useAccount()
  const [open, setOpen] = useState(false)
  const [nsec, setNsec] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNsec(e.target.value)
    setErrMsg(null)
  }

  const handleLogin = async () => {
    const errMsg = await login(nsec)
    if (!errMsg) {
      return setOpen(false)
    }
    setErrMsg(errMsg)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="non-draggable h-7 w-7 p-0 rounded-full flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
        title="login"
      >
        <LogIn size={16} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            Your private key will be encrypted and stored in your device.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="nsec1.."
              value={nsec}
              onChange={handleInputChange}
              className={errMsg ? 'border-destructive' : ''}
            />
            <Button onClick={handleLogin}>Login</Button>
          </div>
          {errMsg && <div className="text-xs text-destructive pl-3">{errMsg}</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
