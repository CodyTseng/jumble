import { createContext, useContext } from 'react'

export const PageActiveContext = createContext<boolean | null>(null)

export function usePageActive() {
  const ctx = useContext(PageActiveContext)
  return ctx ?? false
}
