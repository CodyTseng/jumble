import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import RelayBadges from '@/components/RelayBadges'
import RelayIcon from '@/components/RelayIcon'
import SaveRelayDropdownMenu from '@/components/SaveRelayDropdownMenu'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toRelay } from '@/lib/link'
import relayInfoService from '@/services/relay-info.service'
import { TNip66RelayInfo } from '@/types'
import { ArrowRight, RefreshCcw, Server } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const HomePage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { navigate } = usePrimaryPage()
  const [randomRelayInfos, setRandomRelayInfos] = useState<TNip66RelayInfo[]>([])

  const refresh = useCallback(async () => {
    const relayInfos = await relayInfoService.getRandomRelayInfos(10)
    setRandomRelayInfos(relayInfos)
  }, [])

  useEffect(() => {
    refresh()
  }, [])

  if (!randomRelayInfos.length) {
    return (
      <SecondaryPageLayout ref={ref} index={index} hideBackButton>
        <div className="text-muted-foreground w-full h-screen flex items-center justify-center">
          {t('Welcome! 🥳')}
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={
        <>
          <Server />
          {'Random Relays'}
        </>
      }
      controls={
        <Button variant="ghost" className="h-10 [&_svg]:size-3" onClick={() => refresh()}>
          <RefreshCcw />
          <div>{t('Refresh')}</div>
        </Button>
      }
      hideBackButton
    >
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3">
          {randomRelayInfos.map((relayInfo) => (
            <RelayCard key={relayInfo.url} relayInfo={relayInfo} />
          ))}
        </div>
        <div className="flex mt-2 justify-center">
          <Button variant="ghost" onClick={() => navigate('explore')}>
            <div>{t('Explore more')}</div>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
HomePage.displayName = 'HomePage'
export default HomePage

function RelayCard({ relayInfo }: { relayInfo: TNip66RelayInfo }) {
  const { push } = useSecondaryPage()

  return (
    <div
      className="clickable h-auto space-y-1 p-3 rounded-lg border"
      onClick={(e) => {
        e.stopPropagation()
        push(toRelay(relayInfo.url))
      }}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex flex-1 w-0 items-center gap-2">
          <RelayIcon url={relayInfo.url} className="h-8 w-8" />
          <div className="flex-1 w-0">
            <div className="truncate font-semibold">{relayInfo.name ?? relayInfo.shortUrl}</div>
            {relayInfo.name && (
              <div className="text-xs text-muted-foreground truncate">{relayInfo.shortUrl}</div>
            )}
          </div>
        </div>
        <SaveRelayDropdownMenu urls={[relayInfo.url]} />
      </div>
      <RelayBadges relayInfo={relayInfo} />
      {!!relayInfo?.description && <div className="line-clamp-4">{relayInfo.description}</div>}
    </div>
  )
}
