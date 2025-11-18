import React, { createContext, useContext, useState } from 'react'

interface CurrencyPreferencesContextType {
  displayCurrency: string
  setDisplayCurrency: (currency: string) => void
  isBalanceHidden: boolean
  toggleBalanceVisibility: () => void
}

const CurrencyPreferencesContext = createContext<CurrencyPreferencesContextType | undefined>(
  undefined
)

const STORAGE_KEY_CURRENCY = 'displayCurrency'
const STORAGE_KEY_HIDDEN = 'isBalanceHidden'

export function CurrencyPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_CURRENCY) || 'SATS'
    } catch {
      return 'SATS'
    }
  })

  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HIDDEN)
      return stored === 'true'
    } catch {
      return false
    }
  })

  const setDisplayCurrency = (currency: string) => {
    setDisplayCurrencyState(currency)
    try {
      localStorage.setItem(STORAGE_KEY_CURRENCY, currency)
    } catch (error) {
      console.error('Failed to save currency preference:', error)
    }
  }

  const toggleBalanceVisibility = () => {
    setIsBalanceHidden((prev) => {
      const newValue = !prev
      try {
        localStorage.setItem(STORAGE_KEY_HIDDEN, String(newValue))
      } catch (error) {
        console.error('Failed to save balance visibility preference:', error)
      }
      return newValue
    })
  }

  return (
    <CurrencyPreferencesContext.Provider
      value={{
        displayCurrency,
        setDisplayCurrency,
        isBalanceHidden,
        toggleBalanceVisibility
      }}
    >
      {children}
    </CurrencyPreferencesContext.Provider>
  )
}

export function useCurrencyPreferences() {
  const context = useContext(CurrencyPreferencesContext)
  if (!context) {
    throw new Error('useCurrencyPreferences must be used within CurrencyPreferencesProvider')
  }
  return context
}
