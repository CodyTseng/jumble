import { CARD_RADIUS_VALUES, DEFAULT_CARD_RADIUS } from '@/constants'
import storage from '@/services/local-storage.service'
import { createContext, useContext, useEffect, useState } from 'react'

type TCardRadiusContext = {
  cardRadius: number
  setCardRadius: (radius: number) => void
}

const CardRadiusContext = createContext<TCardRadiusContext | undefined>(undefined)

export const useCardRadius = () => {
  const context = useContext(CardRadiusContext)
  if (!context) {
    throw new Error('useCardRadius must be used within a CardRadiusProvider')
  }
  return context
}

export function CardRadiusProvider({ children }: { children: React.ReactNode }) {
  const [cardRadius, setCardRadiusState] = useState<number>(
    storage.getCardRadius() ?? DEFAULT_CARD_RADIUS
  )

  const setCardRadius = (radius: number) => {
    if (!CARD_RADIUS_VALUES.includes(radius as any)) {
      return
    }
    setCardRadiusState(radius)
    storage.setCardRadius(radius)
  }

  useEffect(() => {
    // Apply the card radius as a CSS variable
    document.documentElement.style.setProperty('--card-radius', `${cardRadius}px`)
  }, [cardRadius])

  return (
    <CardRadiusContext.Provider value={{ cardRadius, setCardRadius }}>
      {children}
    </CardRadiusContext.Provider>
  )
}
