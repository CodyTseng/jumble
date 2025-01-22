import { createContext, Dispatch, SetStateAction, useContext, useState } from 'react'

type TPopupContext = {
  popupWindow: Window | null
  setPopupWindow: Dispatch<SetStateAction<Window | null>>
}

const PopupContext = createContext<TPopupContext | undefined>(undefined)

export const usePopup = () => {
  const context = useContext(PopupContext)
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider')
  }
  return context
}

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [popupWindow, setPopupWindow] = useState<Window | null>(null)

  return (
    <PopupContext.Provider value={{ popupWindow, setPopupWindow }}>
      {children}
    </PopupContext.Provider>
  )
}
