import { DEFAULT_MEDIA_STYLE, MEDIA_STYLE, StorageKey } from '@/constants'
import { TMediaStyle } from '@/types'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

interface IMediaStyleContext {
  mediaStyle: TMediaStyle
  setMediaStyle: (style: TMediaStyle) => void
}

const MediaStyleContext = createContext<IMediaStyleContext | undefined>(undefined)

export function MediaStyleProvider({ children }: { children: ReactNode }) {
  const [mediaStyle, _setMediaStyle] = useState<TMediaStyle>(() => {
    const stored = window.localStorage.getItem(StorageKey.MEDIA_STYLE)
    return (stored as TMediaStyle) || DEFAULT_MEDIA_STYLE
  })

  useEffect(() => {
    window.localStorage.setItem(StorageKey.MEDIA_STYLE, mediaStyle)
  }, [mediaStyle])

  const setMediaStyle = (style: TMediaStyle) => {
    if (style === MEDIA_STYLE.DEFAULT || style === MEDIA_STYLE.FULL_WIDTH) {
      _setMediaStyle(style)
    }
  }

  return (
    <MediaStyleContext.Provider value={{ mediaStyle, setMediaStyle }}>
      {children}
    </MediaStyleContext.Provider>
  )
}

export function useMediaStyle() {
  const context = useContext(MediaStyleContext)
  if (!context) {
    throw new Error('useMediaStyle must be used within a MediaStyleProvider')
  }
  return context
}
