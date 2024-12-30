import { Info } from 'lucide-react'
import AboutInfoDialog from '../AboutInfoDialog'
import SidebarItem from './SidebarItem'

export default function AboutInfoButton() {
  return (
    <AboutInfoDialog>
      <SidebarItem title="About">
        <Info strokeWidth={3} />
      </SidebarItem>
    </AboutInfoDialog>
  )
}
