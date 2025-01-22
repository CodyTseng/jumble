import OthersRelayList from '@/components/OthersRelayList'
import { useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function RelaySettingsPage({ id, index }: { id?: string; index?: number }) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(id)

  if (!id || !profile) {
    return null
  }

  return (
    <SecondaryPageLayout
      index={index}
      title={t("username's used relays", { username: profile.username })}
    >
      <div className="px-4">
        <OthersRelayList userId={id} />
      </div>
    </SecondaryPageLayout>
  )
}
