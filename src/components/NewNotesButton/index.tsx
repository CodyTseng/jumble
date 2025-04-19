import { Button } from '@/components/ui/button'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function NewNotesButton({
  newEvents = [],
  onClick
}: {
  newEvents?: Event[]
  onClick?: () => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const pubkeys = useMemo(() => {
    const arr: string[] = []
    for (const event of newEvents) {
      if (!arr.includes(event.pubkey)) {
        arr.push(event.pubkey)
      }
      if (arr.length >= 3) break
    }
    return arr
  }, [newEvents])

  return (
    <>
      {newEvents.length > 0 && (
        <div
          className={cn(
            'w-full flex justify-center z-40',
            isSmallScreen ? 'fixed' : 'absolute bottom-4'
          )}
          style={isSmallScreen ? { bottom: 'calc(4rem + env(safe-area-inset-bottom))' } : undefined}
        >
          <Button
            onClick={onClick}
            className="group rounded-full h-fit pl-2 pr-3 hover:bg-primary-hover"
          >
            {pubkeys.length > 0 && (
              <div className="flex items-center">
                {pubkeys.map((pubkey, index) => (
                  <div
                    key={pubkey}
                    className="relative -mr-2.5 last:mr-0"
                    style={{ zIndex: 3 - index }}
                  >
                    <SimpleUserAvatar
                      userId={pubkey}
                      size="small"
                      className="border-primary border-2  group-hover:border-primary-hover"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="text-md font-medium">
              {t('Show n new notes', { n: newEvents.length > 99 ? '99+' : newEvents.length })}
            </div>
          </Button>
        </div>
      )}
    </>
  )
}
