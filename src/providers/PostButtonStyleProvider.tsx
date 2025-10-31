import { DEFAULT_POST_BUTTON_STYLE, POST_BUTTON_STYLE } from '@/constants'
import storage from '@/services/local-storage.service'
import { TPostButtonStyle } from '@/types'
import { createContext, useContext, useState } from 'react'

type TPostButtonStyleContext = {
  postButtonStyle: TPostButtonStyle
  setPostButtonStyle: (style: TPostButtonStyle) => void
}

const PostButtonStyleContext = createContext<TPostButtonStyleContext | undefined>(undefined)

export const usePostButtonStyle = () => {
  const context = useContext(PostButtonStyleContext)
  if (!context) {
    throw new Error('usePostButtonStyle must be used within a PostButtonStyleProvider')
  }
  return context
}

export function PostButtonStyleProvider({ children }: { children: React.ReactNode }) {
  const [postButtonStyle, setPostButtonStyleState] = useState<TPostButtonStyle>(
    storage.getPostButtonStyle() ?? DEFAULT_POST_BUTTON_STYLE
  )

  const setPostButtonStyle = (style: TPostButtonStyle) => {
    if (style !== POST_BUTTON_STYLE.FILLED && style !== POST_BUTTON_STYLE.OUTLINED) {
      return
    }
    setPostButtonStyleState(style)
    storage.setPostButtonStyle(style)
  }

  return (
    <PostButtonStyleContext.Provider value={{ postButtonStyle, setPostButtonStyle }}>
      {children}
    </PostButtonStyleContext.Provider>
  )
}
