import { createContext, useContext, useEffect, useRef, useState } from 'react'

type TDeepBrowsingContext = {
  deepBrowsing: boolean
  lastScrollTop: number
}

const DeepBrowsingContext = createContext<TDeepBrowsingContext | undefined>(undefined)

export const useDeepBrowsing = () => {
  const context = useContext(DeepBrowsingContext)
  if (!context) {
    throw new Error('useDeepBrowsing must be used within a DeepBrowsingProvider')
  }
  return context
}

export function DeepBrowsingProvider({
  children,
  active,
  scrollAreaRef
}: {
  children: React.ReactNode
  active: boolean
  scrollAreaRef?: React.RefObject<HTMLDivElement>
}) {
  const [deepBrowsing, setDeepBrowsing] = useState(false)
  const lastScrollTopRef = useRef(
    (!scrollAreaRef ? window.scrollY : scrollAreaRef.current?.scrollTop) || 0
  )

  useEffect(() => {
    setDeepBrowsing(false)
    if (!active) return

    const handleScroll = () => {
      const atBottom = !scrollAreaRef
        ? window.innerHeight + window.scrollY >= document.body.offsetHeight - 20
        : scrollAreaRef.current
          ? scrollAreaRef.current?.clientHeight + scrollAreaRef.current?.scrollTop >=
            scrollAreaRef.current?.scrollHeight - 20
          : false
      if (atBottom) {
        setDeepBrowsing(false)
        return
      }

      const scrollTop = (!scrollAreaRef ? window.scrollY : scrollAreaRef.current?.scrollTop) || 0
      const diff = scrollTop - lastScrollTopRef.current
      lastScrollTopRef.current = scrollTop
      if (scrollTop <= 800) {
        setDeepBrowsing(false)
        return
      }

      if (diff > 20) {
        setDeepBrowsing(true)
      } else if (diff < -20) {
        setDeepBrowsing(false)
      }
    }

    if (!scrollAreaRef) {
      window.addEventListener('scroll', handleScroll)
      return () => {
        window.removeEventListener('scroll', handleScroll)
      }
    }

    scrollAreaRef.current?.addEventListener('scroll', handleScroll)
    return () => {
      scrollAreaRef.current?.removeEventListener('scroll', handleScroll)
    }
  }, [active])

  return (
    <DeepBrowsingContext.Provider value={{ deepBrowsing, lastScrollTop: lastScrollTopRef.current }}>
      {children}
    </DeepBrowsingContext.Provider>
  )
}
