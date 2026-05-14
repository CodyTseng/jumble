import { createContext, ReactNode, RefObject, useContext } from 'react'

type TScrollAreaContext = {
  scrollAreaRef?: RefObject<HTMLDivElement>
}

const ScrollAreaContext = createContext<TScrollAreaContext>({})

export const useScrollArea = () => useContext(ScrollAreaContext)

export function ScrollAreaProvider({
  scrollAreaRef,
  children
}: {
  scrollAreaRef?: RefObject<HTMLDivElement>
  children: ReactNode
}) {
  return (
    <ScrollAreaContext.Provider value={{ scrollAreaRef }}>{children}</ScrollAreaContext.Provider>
  )
}
