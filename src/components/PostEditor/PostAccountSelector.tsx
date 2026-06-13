import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { isSameAccount } from '@/lib/account'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TAccountPointer } from '@/types'
import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SignerTypeBadge from '../SignerTypeBadge'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function PostAccountSelector({
  value,
  onChange
}: {
  value: TAccountPointer | null
  onChange: (account: TAccountPointer) => void
}) {
  const { t } = useTranslation()
  const { accounts } = useNostr()
  const { isSmallScreen } = useScreenSize()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Only accounts that can sign can publish; npub accounts are read-only.
  const signableAccounts = useMemo(
    () => accounts.filter((act) => act.signerType !== 'npub'),
    [accounts]
  )

  // Nothing to switch between — keep the editor chrome clean.
  if (signableAccounts.length <= 1 || !value) {
    return null
  }

  const triggerButton = (
    <button
      type="button"
      title={t('Post as')}
      className="clickable text-muted-foreground hover:bg-accent hover:text-foreground -ms-1 flex max-w-full items-center gap-2 rounded-lg px-1.5 py-1 transition-colors"
    >
      <SimpleUserAvatar userId={value.pubkey} ignorePolicy className="shrink-0" />
      <div className="min-w-0 flex-1 text-start">
        <SimpleUsername
          userId={value.pubkey}
          className="text-foreground block truncate text-sm font-semibold"
          skeletonClassName="h-3"
        />
        <SignerTypeBadge signerType={value.signerType} className="whitespace-nowrap" />
      </div>
      <ChevronDown className="size-4 shrink-0" />
    </button>
  )

  // Shared inner content for a single account row (avatar, name, signer type, check).
  const renderRowInner = (act: TAccountPointer, isSelected: boolean) => (
    <>
      <SimpleUserAvatar userId={act.pubkey} ignorePolicy className="shrink-0" />
      <div className="min-w-0 flex-1">
        <SimpleUsername
          userId={act.pubkey}
          className="block truncate text-sm font-semibold"
          skeletonClassName="h-3 w-24"
        />
        <div className="mt-0.5">
          <SignerTypeBadge signerType={act.signerType} className="whitespace-nowrap" />
        </div>
      </div>
      <Check
        className={cn('text-primary size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
      />
    </>
  )

  if (isSmallScreen) {
    return (
      <div className="flex px-5 pt-2">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
          <DrawerContent title={t('Post as')}>
            <DrawerTitle className="px-4 pb-2 text-base font-semibold">{t('Post as')}</DrawerTitle>
            <div className="max-h-[60vh] space-y-1 overflow-y-auto px-2 pb-2">
              {signableAccounts.map((act) => {
                const isSelected = isSameAccount(act, value)
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
                      if (!isSelected) onChange(act)
                      setDrawerOpen(false)
                    }}
                  >
                    {renderRowInner(act, isSelected)}
                  </button>
                )
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    )
  }

  return (
    <div className="flex px-5 pt-2 sm:px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
          {signableAccounts.map((act) => {
            const isSelected = isSameAccount(act, value)
            return (
              <DropdownMenuItem
                key={`${act.pubkey}-${act.signerType}`}
                className={cn(
                  'gap-2',
                  isSelected &&
                    'bg-primary/10 ring-primary/40 focus:bg-primary/10 cursor-default ring-1 ring-inset'
                )}
                onSelect={() => {
                  if (!isSelected) onChange(act)
                }}
              >
                {renderRowInner(act, isSelected)}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
