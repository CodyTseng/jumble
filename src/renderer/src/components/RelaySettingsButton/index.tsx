import RelaySettings from '@renderer/components/RelaySettings'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { toRelaySettings } from '@renderer/lib/link'
import { SecondaryPageLink } from '@renderer/PageManager'
import { useScreenSize } from '@renderer/providers/ScreenSizeProvider'
import { Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function RelaySettingsButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar'
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <SecondaryPageLink to={toRelaySettings()}>
        <Button variant={variant} size={variant} title={t('Relay settings')}>
          <Server />
          {variant === 'sidebar' && <div>{t('SidebarRelays')}</div>}
        </Button>
      </SecondaryPageLink>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={variant} size={variant} title={t('Relay settings')}>
          <Server />
          {variant === 'sidebar' && <div>{t('SidebarRelays')}</div>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 h-[450px] p-0"
        side={variant === 'titlebar' ? 'bottom' : 'right'}
      >
        <ScrollArea className="h-full">
          <div className="p-4">
            <RelaySettings />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
