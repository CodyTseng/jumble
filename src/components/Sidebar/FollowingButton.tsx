import { usePrimaryPage } from '@/PageManager'
import { Users2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function FollowingButton({ collapse }: { collapse: boolean }) {
  const { t } = useTranslation()
  const { navigate, current, display } = usePrimaryPage()

  return (
    <SidebarItem
      title={t('Following')}
      onClick={() => navigate('following')}
      active={display && current === 'following'}
      collapse={collapse}
    >
      <Users2 />
    </SidebarItem>
  )
}
