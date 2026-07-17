import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { isSameAccount } from '@/lib/account'
import { createEphemeralNsecAccount, isEphemeralPostAccount } from '@/lib/post-account'
import { isPomegranateAccountByPointer } from '@/lib/pomegranate'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TAccount, TAccountPointer } from '@/types'
import { ChevronDown, VenetianMask } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SignerTypeBadge from '../SignerTypeBadge'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function PostAccountSelector({
  value,
  onChange,
  allowAnonymous = false
}: {
  value: TAccount | null
  onChange: (account: TAccount) => void
  allowAnonymous?: boolean
}) {
  const { t } = useTranslation()
  const { accounts, pubkey } = useNostr()
  const { isSmallScreen } = useScreenSize()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Only accounts that can sign can publish; npub accounts are read-only.
  const signableAccounts = useMemo(
    () => accounts.filter((act) => act.signerType !== 'npub'),
    [accounts]
  )
  const isAnonymous = isEphemeralPostAccount(value)

  // Normal posts keep the existing compact behavior. Reply composers always
  // expose the selector because the one-time anonymous identity is a choice.
  if ((!allowAnonymous && signableAccounts.length <= 1) || !value) {
    return null
  }

  const triggerButton = (
    <button
      type="button"
      title={t('Post as')}
      className="clickable text-muted-foreground hover:bg-accent hover:text-foreground -ms-1 flex h-14 max-w-full items-center gap-2 rounded-lg px-1.5 py-2 transition-colors"
    >
      {isAnonymous ? (
        <>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <VenetianMask className="size-5" />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="text-foreground truncate text-sm font-semibold">{t('Anonymous')}</div>
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
              <span className="size-1.5 rounded-full bg-violet-500" />
              {t('One-time identity')}
            </span>
          </div>
        </>
      ) : (
        value && (
          <>
            <SimpleUserAvatar userId={value.pubkey} ignorePolicy className="shrink-0" />
            <div className="min-w-0 flex-1 text-start">
              <SimpleUsername
                userId={value.pubkey}
                className="text-foreground block truncate text-sm font-semibold"
                skeletonClassName="h-3"
              />
              <SignerTypeBadge
                signerType={value.signerType}
                isPomegranate={isPomegranateAccountByPointer(value)}
                className="whitespace-nowrap"
              />
            </div>
          </>
        )
      )}
      <ChevronDown className="size-4 shrink-0" />
    </button>
  )

  // Shared inner content for a single account row (avatar, name, signer type).
  const renderRowInner = (act: TAccountPointer) => (
    <>
      <SimpleUserAvatar userId={act.pubkey} ignorePolicy className="shrink-0" />
      <div className="min-w-0 flex-1">
        <SimpleUsername
          userId={act.pubkey}
          className="block truncate text-sm font-semibold"
          skeletonClassName="h-3 w-24"
        />
        <div className="mt-0.5">
          <SignerTypeBadge
            signerType={act.signerType}
            isPomegranate={isPomegranateAccountByPointer(act)}
            className="whitespace-nowrap"
          />
        </div>
      </div>
    </>
  )

  const anonymousRowInner = (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400">
        <VenetianMask className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{t('Anonymous')}</div>
        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-violet-500" />
          {t('One-time identity')}
        </span>
      </div>
    </>
  )

  const selectAccount = (act: TAccountPointer, isSelected: boolean) => {
    if (!isSelected) onChange(act)
  }

  const selectAnonymous = () => {
    if (!isAnonymous && pubkey) onChange(createEphemeralNsecAccount(pubkey))
  }

  if (isSmallScreen) {
    return (
      <div className="flex px-5 py-1">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
          <DrawerContent title={t('Post as')}>
            <DrawerTitle className="px-4 pb-2 text-base font-semibold">{t('Post as')}</DrawerTitle>
            <div className="max-h-[60vh] space-y-1 overflow-y-auto px-2 pb-2">
              {signableAccounts.map((act) => {
                const isSelected = !isAnonymous && !!value && isSameAccount(act, value)
                return (
                  <button
                    key={`${act.pubkey}-${act.signerType}`}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg p-2 text-start transition-colors',
                      isSelected
                        ? 'bg-primary/10 ring-primary/40 ring-1 ring-inset'
                        : 'hover:bg-accent'
                    )}
                    onClick={() => {
                      selectAccount(act, isSelected)
                      setDrawerOpen(false)
                    }}
                  >
                    {renderRowInner(act)}
                  </button>
                )
              })}
              {allowAnonymous && (
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg p-2 text-start transition-colors',
                    signableAccounts.length > 0 && 'border-t',
                    isAnonymous
                      ? 'bg-violet-500/10 ring-1 ring-violet-500/40 ring-inset'
                      : 'hover:bg-accent'
                  )}
                  onClick={() => {
                    selectAnonymous()
                    setDrawerOpen(false)
                  }}
                >
                  {anonymousRowInner}
                </button>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    )
  }

  return (
    <div className="flex px-5 py-1 sm:px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
          {signableAccounts.map((act) => {
            const isSelected = !isAnonymous && !!value && isSameAccount(act, value)
            return (
              <DropdownMenuItem
                key={`${act.pubkey}-${act.signerType}`}
                className={cn(
                  'gap-2',
                  isSelected &&
                    'bg-primary/10 ring-primary/40 focus:bg-primary/10 cursor-default ring-1 ring-inset'
                )}
                onSelect={() => {
                  selectAccount(act, isSelected)
                }}
              >
                {renderRowInner(act)}
              </DropdownMenuItem>
            )
          })}
          {allowAnonymous && (
            <>
              {signableAccounts.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className={cn(
                  'items-center gap-2',
                  isAnonymous &&
                    'cursor-default bg-violet-500/10 ring-1 ring-violet-500/40 ring-inset focus:bg-violet-500/10'
                )}
                onSelect={selectAnonymous}
              >
                {anonymousRowInner}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
