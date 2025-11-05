import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TWidgetSidebarTitleContext = {
  widgetSidebarTitle: string
  setWidgetSidebarTitle: (title: string) => void
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

  const setWidgetSidebarTitle = (title: string) => {
    setWidgetSidebarTitleState(title)
    storage.setWidgetSidebarTitle(title)
  }

  return (
    <WidgetSidebarTitleContext.Provider
      value={{
        widgetSidebarTitle,
        setWidgetSidebarTitle
      }}
    >
      {children}
    </WidgetSidebarTitleContext.Provider>
  )
}
