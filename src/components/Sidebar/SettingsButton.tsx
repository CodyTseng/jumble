import { toSettings } from '@/lib/link'
import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { Settings } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function SettingsButton({ collapse }: { collapse: boolean }) {
  const { current, navigate, display } = usePrimaryPage()
  const { push } = useSecondaryPage()
  const { enableSingleColumnLayout } = useUserPreferences()

  return (
    <SidebarItem
      title="Settings"
      onClick={() => (enableSingleColumnLayout ? navigate('settings') : push(toSettings()))}
      collapse={collapse}
      active={display && current === 'settings'}
    >
      <Settings />
    </SidebarItem>
  )
}
