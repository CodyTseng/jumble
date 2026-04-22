import { toSettings } from '@/lib/link'
import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { GearSixIcon } from '@phosphor-icons/react'
import SidebarItem from './SidebarItem'

export default function SettingsButton({ collapse }: { collapse: boolean }) {
  const { current, navigate, display } = usePrimaryPage()
  const { push } = useSecondaryPage()
  const { enableSingleColumnLayout } = useUserPreferences()
  const active = display && current === 'settings'

  return (
    <SidebarItem
      title="Settings"
      onClick={() => (enableSingleColumnLayout ? navigate('settings') : push(toSettings()))}
      collapse={collapse}
      active={active}
    >
      <GearSixIcon weight={active ? 'fill' : 'bold'} />
    </SidebarItem>
  )
}
