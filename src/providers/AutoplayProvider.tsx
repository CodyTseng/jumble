import { createContext, useContext, useState } from 'react'
import storage from '@/services/local-storage.service'

type TAutoplayContext = {
  autoplay: boolean
  setAutoplay: (autoplay: boolean) => void
}

const AutoplayContext = createContext<TAutoplayContext | undefined>(undefined)

export const useAutoplay = () => {
  const context = useContext(AutoplayContext)
  if (!context) {
    throw new Error('useAutoplay must be used within an AutoplayProvider')
  }
  return context
}

export function AutoplayProvider({ children }: { children: React.ReactNode }) {
  const [autoplay, setAutoplay] = useState<boolean>(storage.getAutoplay())

  const updateAutoplay = (autoplay: boolean) => {
    storage.setAutoplay(autoplay)
    setAutoplay(autoplay)
  }

  return (
    <AutoplayContext.Provider value={{ autoplay, setAutoplay: updateAutoplay }}>
      {children}
    </AutoplayContext.Provider>
  )
}
