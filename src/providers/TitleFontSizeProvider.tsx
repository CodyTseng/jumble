import { DEFAULT_TITLE_FONT_SIZE } from '@/constants'
import storage from '@/services/local-storage.service'
import { createContext, useContext, useEffect, useState } from 'react'

type TTitleFontSizeContext = {
  titleFontSize: number
  setTitleFontSize: (size: number) => void
}

const TitleFontSizeContext = createContext<TTitleFontSizeContext | undefined>(undefined)

export const useTitleFontSize = () => {
  const context = useContext(TitleFontSizeContext)
  if (!context) {
    throw new Error('useTitleFontSize must be used within a TitleFontSizeProvider')
  }
  return context
}

export function TitleFontSizeProvider({ children }: { children: React.ReactNode }) {
  const [titleFontSize, setTitleFontSizeState] = useState<number>(
    storage.getTitleFontSize() ?? DEFAULT_TITLE_FONT_SIZE
  )

  const setTitleFontSize = (size: number) => {
    setTitleFontSizeState(size)
    storage.setTitleFontSize(size)
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--title-font-size', `${titleFontSize}px`)
  }, [titleFontSize])

  return (
    <TitleFontSizeContext.Provider value={{ titleFontSize, setTitleFontSize }}>
      {children}
    </TitleFontSizeContext.Provider>
  )
}
