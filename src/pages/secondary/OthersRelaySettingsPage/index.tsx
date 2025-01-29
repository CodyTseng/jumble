import OthersRelayList from '@/components/OthersRelayList'
import { useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const RelaySettingsPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(id)

  if (!id || !profile) {
    return null
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={t("username's used relays", { username: profile.username })}
    >
      <div className="px-4">
        <OthersRelayList userId={id} />
      </div>
    </SecondaryPageLayout>
  )
})
RelaySettingsPage.displayName = 'RelaySettingsPage'
export default RelaySettingsPage
