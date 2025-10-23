import { Button } from '@/components/ui/button'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { hasBackgroundAudioAtom } from '@/services/media-manager.service'
import { useAtomValue } from 'jotai'
import { ArrowUp } from 'lucide-react'
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
  const { enableSingleColumnLayout } = useUserPreferences()
  const { isSmallScreen } = useScreenSize()
  const hasBackgroundAudio = useAtomValue(hasBackgroundAudioAtom)
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
            'w-full flex justify-center z-40 pointer-events-none',
            enableSingleColumnLayout ? 'sticky' : 'absolute'
          )}
          style={{
            bottom: isSmallScreen
              ? `calc(${hasBackgroundAudio ? 7.35 : 4}rem + env(safe-area-inset-bottom))`
              : '1rem'
          }}
        >
          <Button
            onClick={onClick}
            className="group rounded-full h-fit py-2 pl-2 pr-3 hover:bg-primary-hover pointer-events-auto"
          >
            {pubkeys.length > 0 && (
              <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:grayscale">
                {pubkeys.map((pubkey) => (
                  <SimpleUserAvatar key={pubkey} userId={pubkey} size="small" />
                ))}
              </div>
            )}
            <div className="text-md font-medium">
              {t('Show n new notes', { n: newEvents.length > 99 ? '99+' : newEvents.length })}
            </div>
            <ArrowUp />
          </Button>
        </div>
      )}
    </>
  )
}
