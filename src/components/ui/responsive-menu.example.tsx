/**
 * ResponsiveMenu 组合式 API 使用示例
 *
 * 这个版本采用组合式 API，与 DropdownMenu/Drawer 的使用方式一致
 */

import * as React from 'react'
import {
  ResponsiveMenu,
  ResponsiveMenuTrigger,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuLabel,
  ResponsiveMenuSub,
  ResponsiveMenuSubTrigger,
  ResponsiveMenuSubContent
} from './responsive-menu'
import { Button } from './button'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Badge } from './badge'
import {
  Menu,
  Copy,
  Share2,
  Trash2,
  Settings,
  User,
  Bell,
  Wallet,
  Plus,
  LogOut,
  SatelliteDish
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// 1. Basic Example
// ============================================================================

export function BasicExample() {
  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button variant="outline">
          <Menu />
          Actions
        </Button>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent>
        <ResponsiveMenuItem onClick={() => toast.success('Copied!')}>
          <Copy />
          Copy
        </ResponsiveMenuItem>

        <ResponsiveMenuItem onClick={() => toast.success('Shared!')}>
          <Share2 />
          Share
        </ResponsiveMenuItem>

        <ResponsiveMenuSeparator />

        <ResponsiveMenuItem
          onClick={() => toast.error('Deleted!')}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 />
          Delete
        </ResponsiveMenuItem>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}

// ============================================================================
// 2. With Sub Menu Example
// ============================================================================

export function WithSubMenuExample() {
  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu />
        </Button>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent>
        <ResponsiveMenuItem onClick={() => toast.success('Profile')}>
          <User />
          Profile
        </ResponsiveMenuItem>

        <ResponsiveMenuSub>
          <ResponsiveMenuSubTrigger>
            <Settings />
            Settings
          </ResponsiveMenuSubTrigger>
          <ResponsiveMenuSubContent>
            <ResponsiveMenuItem onClick={() => toast.success('General settings')}>
              General
            </ResponsiveMenuItem>
            <ResponsiveMenuSeparator />
            <ResponsiveMenuItem onClick={() => toast.success('Privacy settings')}>
              Privacy
            </ResponsiveMenuItem>
            <ResponsiveMenuItem onClick={() => toast.success('Advanced settings')}>
              Advanced
            </ResponsiveMenuItem>
          </ResponsiveMenuSubContent>
        </ResponsiveMenuSub>

        <ResponsiveMenuSub>
          <ResponsiveMenuSubTrigger>
            <Bell />
            Notifications
          </ResponsiveMenuSubTrigger>
          <ResponsiveMenuSubContent>
            <ResponsiveMenuItem onClick={() => toast.success('Enabled all')}>
              Enable all
            </ResponsiveMenuItem>
            <ResponsiveMenuItem
              onClick={() => toast.success('Disabled all')}
              className="text-destructive focus:text-destructive"
            >
              Disable all
            </ResponsiveMenuItem>
          </ResponsiveMenuSubContent>
        </ResponsiveMenuSub>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}

// ============================================================================
// 3. Controlled Example
// ============================================================================

export function ControlledExample() {
  const [open, setOpen] = React.useState(false)

  return (
    <div>
      <ResponsiveMenu open={open} onOpenChange={setOpen}>
        <ResponsiveMenuTrigger asChild>
          <Button>Open Menu</Button>
        </ResponsiveMenuTrigger>

        <ResponsiveMenuContent>
          <ResponsiveMenuItem onClick={() => toast.success('Copied!')}>
            <Copy />
            Copy
          </ResponsiveMenuItem>
        </ResponsiveMenuContent>
      </ResponsiveMenu>

      <p className="mt-2 text-sm text-muted-foreground">Menu is {open ? 'open' : 'closed'}</p>
    </div>
  )
}

// ============================================================================
// 4. Account Switcher Example
// ============================================================================

export function AccountButtonExample() {
  const accounts = [
    {
      pubkey: 'npub1abc...',
      name: 'Alice',
      avatar: 'https://i.pravatar.cc/150?img=1',
      signerType: 'extension'
    },
    {
      pubkey: 'npub1def...',
      name: 'Bob',
      avatar: 'https://i.pravatar.cc/150?img=2',
      signerType: 'nsec'
    }
  ]

  const [currentAccount, setCurrentAccount] = React.useState(accounts[0])

  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={currentAccount.avatar} />
            <AvatarFallback>{currentAccount.name[0]}</AvatarFallback>
          </Avatar>
          <span className="flex-1 text-left truncate">{currentAccount.name}</span>
        </Button>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent side="top" className="w-72">
        <ResponsiveMenuItem onClick={() => toast.success('Wallet')}>
          <Wallet />
          Wallet
        </ResponsiveMenuItem>

        <ResponsiveMenuSeparator />
        <ResponsiveMenuLabel>Switch account</ResponsiveMenuLabel>

        {accounts.map((account) => (
          <ResponsiveMenuItem
            key={account.pubkey}
            onClick={() => setCurrentAccount(account)}
            className={
              account.pubkey === currentAccount.pubkey ? 'cursor-default focus:bg-background' : ''
            }
          >
            <div className="flex gap-2 items-center flex-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src={account.avatar} />
                <AvatarFallback>{account.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 w-0">
                <div className="font-medium truncate">{account.name}</div>
                <Badge variant="outline" className="text-xs">
                  {account.signerType}
                </Badge>
              </div>
            </div>
            <div
              className={`border border-muted-foreground rounded-full h-3.5 w-3.5 ${
                account.pubkey === currentAccount.pubkey && 'h-4 w-4 border-4 border-primary'
              }`}
            />
          </ResponsiveMenuItem>
        ))}

        <div className="border border-dashed m-2 rounded-md">
          <ResponsiveMenuItem onClick={() => toast.success('Add account')}>
            <div className="flex gap-2 items-center justify-center w-full py-2">
              <Plus />
              Add an Account
            </div>
          </ResponsiveMenuItem>
        </div>

        <ResponsiveMenuItem
          onClick={() => toast.error('Logout')}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          <span className="shrink-0">Logout</span>
          <span className="text-muted-foreground border border-muted-foreground px-1 rounded-md text-xs truncate ml-auto">
            {currentAccount.name}
          </span>
        </ResponsiveMenuItem>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}

// ============================================================================
// 5. Complex Sub Menu Example
// ============================================================================

export function ComplexSubMenuExample() {
  const relays = [
    { url: 'wss://relay1.example.com', name: 'Relay 1', status: 'connected' },
    { url: 'wss://relay2.example.com', name: 'Relay 2', status: 'connecting' },
    { url: 'wss://relay3.example.com', name: 'Relay 3', status: 'disconnected' }
  ]

  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button variant="outline">
          <Menu />
          Actions
        </Button>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent showScrollButtons>
        <ResponsiveMenuItem onClick={() => toast.success('Copied ID')}>
          <Copy />
          Copy ID
        </ResponsiveMenuItem>

        <ResponsiveMenuItem onClick={() => toast.success('Copied user ID')}>
          <Copy />
          Copy user ID
        </ResponsiveMenuItem>

        <ResponsiveMenuItem onClick={() => toast.success('Copied link')}>
          <Share2 />
          Copy share link
        </ResponsiveMenuItem>

        <ResponsiveMenuSeparator />

        <ResponsiveMenuSub>
          <ResponsiveMenuSubTrigger>
            <SatelliteDish />
            Republish to ...
          </ResponsiveMenuSubTrigger>
          <ResponsiveMenuSubContent showScrollButtons>
            <ResponsiveMenuItem onClick={() => toast.success('Republishing to optimal relays')}>
              <div className="text-left">Optimal relays</div>
            </ResponsiveMenuItem>

            <ResponsiveMenuSeparator />

            {relays.map((relay) => (
              <ResponsiveMenuItem
                key={relay.url}
                onClick={() => toast.success(`Republishing to ${relay.name}`)}
              >
                <div className="flex items-center gap-2 w-full">
                  <SatelliteDish className="h-4 w-4" />
                  <div className="flex-1 truncate text-left">{relay.name}</div>
                  <Badge
                    variant={relay.status === 'connected' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {relay.status}
                  </Badge>
                </div>
              </ResponsiveMenuItem>
            ))}
          </ResponsiveMenuSubContent>
        </ResponsiveMenuSub>

        <ResponsiveMenuSeparator />

        <ResponsiveMenuItem
          onClick={() => toast.error('Deleting...')}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 />
          Delete
        </ResponsiveMenuItem>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}

// ============================================================================
// 6. Dynamic Content Example
// ============================================================================

export function DynamicContentExample() {
  const [canDelete, setCanDelete] = React.useState(true)
  const [isPinned, setIsPinned] = React.useState(false)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setCanDelete(!canDelete)}>
          Toggle Delete Permission
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsPinned(!isPinned)}>
          Toggle Pin Status
        </Button>
      </div>

      <ResponsiveMenu>
        <ResponsiveMenuTrigger asChild>
          <Button>Menu</Button>
        </ResponsiveMenuTrigger>

        <ResponsiveMenuContent>
          <ResponsiveMenuItem onClick={() => toast.success('Copied')}>
            <Copy />
            Copy
          </ResponsiveMenuItem>

          <ResponsiveMenuItem onClick={() => toast.success('Shared')}>
            <Share2 />
            Share
          </ResponsiveMenuItem>

          {/* 条件渲染 */}
          {isPinned && (
            <>
              <ResponsiveMenuSeparator />
              <ResponsiveMenuItem onClick={() => setIsPinned(false)}>Unpin</ResponsiveMenuItem>
            </>
          )}

          {canDelete && (
            <>
              <ResponsiveMenuSeparator />
              <ResponsiveMenuItem
                onClick={() => toast.error('Deleted')}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                Delete
              </ResponsiveMenuItem>
            </>
          )}
        </ResponsiveMenuContent>
      </ResponsiveMenu>
    </div>
  )
}

// ============================================================================
// 7. Custom Style Example
// ============================================================================

export function CustomStyleExample() {
  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button>Custom Menu</Button>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent
        className="w-80"
        align="end"
        side="bottom"
        sideOffset={8}
        showScrollButtons
      >
        <ResponsiveMenuItem onClick={() => toast.success('Copied')}>
          <Copy />
          Copy
        </ResponsiveMenuItem>

        <ResponsiveMenuItem onClick={() => toast.success('Shared')}>
          <Share2 />
          Share
        </ResponsiveMenuItem>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}
