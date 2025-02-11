import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import RelaySimpleInfo from '@/components/RelaySimpleInfo'
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
  const { push } = useSecondaryPage()
  const [randomRelayInfos, setRandomRelayInfos] = useState<TNip66RelayInfo[]>([])

  const refresh = useCallback(async () => {
    const relayInfos = await relayInfoService.getRandomRelayInfos(10)
    const relayUrls = new Set<string>()
    const uniqueRelayInfos = relayInfos.filter((relayInfo) => {
      if (relayUrls.has(relayInfo.url)) {
        return false
      }
      relayUrls.add(relayInfo.url)
      return true
    })
    setRandomRelayInfos(uniqueRelayInfos)
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
          <div>{t('Random Relays')}</div>
        </>
      }
      controls={
        <Button variant="ghost" className="h-10 [&_svg]:size-3" onClick={() => refresh()}>
          <RefreshCcw />
          <div>{t('randomRelaysRefresh')}</div>
        </Button>
      }
      hideBackButton
    >
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3">
          {randomRelayInfos.map((relayInfo) => (
            <RelaySimpleInfo
              key={relayInfo.url}
              className="clickable h-auto p-3 rounded-lg border"
              relayInfo={relayInfo}
              onClick={(e) => {
                e.stopPropagation()
                push(toRelay(relayInfo.url))
              }}
            />
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
