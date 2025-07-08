import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import RelaySimpleInfo from '@/components/RelaySimpleInfo'
import { Button } from '@/components/ui/button'
import { RECOMMENDED_RELAYS } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toRelay } from '@/lib/link'
import relayInfoService from '@/services/relay-info.service'
import { TNip66RelayInfo } from '@/types'
import { ArrowRight, Server } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const HomePage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { navigate } = usePrimaryPage()
  const { push } = useSecondaryPage()
  const [recommendedRelayInfos, setRecommendedRelayInfos] = useState<TNip66RelayInfo[]>([])

  useEffect(() => {
    const init = async () => {
      try {
        const relays = await relayInfoService.getRelayInfos(RECOMMENDED_RELAYS)
        setRecommendedRelayInfos(relays.filter(Boolean) as TNip66RelayInfo[])
      } catch (error) {
        console.error('Failed to fetch recommended relays:', error)
      }
    }
    init()
  }, [])

  if (!recommendedRelayInfos.length) {
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
          <div>{t('Recommended relays')}</div>
        </>
      }
      hideBackButton
    >
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3">
          {recommendedRelayInfos.map((relayInfo) => (
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
