import { usePrimaryPage } from '@/PageManager'
import { Clapperboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'

export default function DivineButton({ collapse }: { collapse: boolean }) {
  const { t } = useTranslation()
  const { current, navigate } = usePrimaryPage()

  return (
    <SidebarItem
      active={current === 'divine'}
      collapse={collapse}
      icon={<Clapperboard />}
      label={t('Divine')}
      onClick={() => navigate('divine')}
    />
  )
}
