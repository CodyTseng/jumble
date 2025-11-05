import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TWidgetSidebarTitleContext = {
  widgetSidebarTitle: string
  setWidgetSidebarTitle: (title: string) => void
  widgetSidebarIcon: string | null
  setWidgetSidebarIcon: (icon: string | null) => void
}

const WidgetSidebarTitleContext = createContext<TWidgetSidebarTitleContext | undefined>(undefined)

export const useWidgetSidebarTitle = () => {
  const context = useContext(WidgetSidebarTitleContext)
  if (!context) {
    throw new Error('useWidgetSidebarTitle must be used within a WidgetSidebarTitleProvider')
  }
  return context
}

export function WidgetSidebarTitleProvider({ children }: { children: React.ReactNode }) {
  const [widgetSidebarTitle, setWidgetSidebarTitleState] = useState(storage.getWidgetSidebarTitle())
  const [widgetSidebarIcon, setWidgetSidebarIconState] = useState(storage.getWidgetSidebarIcon())

  const setWidgetSidebarTitle = (title: string) => {
    setWidgetSidebarTitleState(title)
    storage.setWidgetSidebarTitle(title)
  }

  const setWidgetSidebarIcon = (icon: string | null) => {
    setWidgetSidebarIconState(icon)
    storage.setWidgetSidebarIcon(icon)
  }

  return (
    <WidgetSidebarTitleContext.Provider
      value={{
        widgetSidebarTitle,
        setWidgetSidebarTitle,
        widgetSidebarIcon,
        setWidgetSidebarIcon
      }}
    >
      {children}
    </WidgetSidebarTitleContext.Provider>
  )
}
