import Sidebar from '@renderer/components/Sidebar'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { cn } from '@renderer/lib/utils'
import HomePage from '@renderer/pages/secondary/HomePage'
import NotFoundPage from '@renderer/pages/secondary/NotFoundPage'
import { cloneElement, createContext, useContext, useEffect, useState } from 'react'
import { routes } from './routes'

type TPrimaryPageContext = {
  refresh: () => void
}

type TSecondaryPageContext = {
  push: (url: string) => void
  pop: () => void
}

type TStackItem = {
  index: number
  url: string
  component: React.ReactNode | null
}

const PrimaryPageContext = createContext<TPrimaryPageContext | undefined>(undefined)

const SecondaryPageContext = createContext<TSecondaryPageContext | undefined>(undefined)

export function usePrimaryPage() {
  const context = useContext(PrimaryPageContext)
  if (!context) {
    throw new Error('usePrimaryPage must be used within a PrimaryPageContext.Provider')
  }
  return context
}

export function useSecondaryPage() {
  const context = useContext(SecondaryPageContext)
  if (!context) {
    throw new Error('usePrimaryPage must be used within a SecondaryPageContext.Provider')
  }
  return context
}

export function PageManager({
  children,
  maxStackSize = 5
}: {
  children: React.ReactNode
  maxStackSize?: number
}) {
  const [primaryPageKey, setPrimaryPageKey] = useState<number>(0)
  const [secondaryStack, setSecondaryStack] = useState<TStackItem[]>([])

  useEffect(() => {
    const url = window.location.pathname
    if (url !== '/') {
      pushSecondary(url)
    }

    const onPopState = (e: PopStateEvent) => {
      const state = e.state ?? { index: -1, url: '/' }
      setSecondaryStack((pre) => {
        const currentItem = pre[pre.length - 1]
        const currentIndex = currentItem ? currentItem.index : -1
        if (state.index === currentIndex) {
          return pre
        }
        if (state.index < currentIndex) {
          const newStack = pre.filter((item) => item.index <= state.index)
          const topItem = newStack[newStack.length - 1]
          if (topItem && !topItem.component) {
            topItem.component = findAndCreateComponent(topItem.url)
          }
          return newStack
        }

        const { newStack } = pushNewPageToStack(pre, state.url, maxStackSize)
        return newStack
      })
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  const refreshPrimary = () => setPrimaryPageKey((prevKey) => prevKey + 1)

  const pushSecondary = (url: string) => {
    setSecondaryStack((prevStack) => {
      if (isCurrentPage(prevStack, url)) return prevStack

      const { newStack, newItem } = pushNewPageToStack(prevStack, url, maxStackSize)
      if (newItem) {
        window.history.pushState({ index: newItem.index, url }, '', url)
      }
      return newStack
    })
  }

  const popSecondary = () => {
    window.history.back()
  }

  return (
    <PrimaryPageContext.Provider value={{ refresh: refreshPrimary }}>
      <SecondaryPageContext.Provider value={{ push: pushSecondary, pop: popSecondary }}>
        <div className="flex h-full">
          <Sidebar />
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={55} minSize={30}>
              <div key={primaryPageKey} className="h-full">
                {children}
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={45} minSize={30} className="relative">
              {secondaryStack.length ? (
                secondaryStack.map((item, index) => (
                  <div
                    key={item.index}
                    className="absolute top-0 left-0 w-full h-full bg-background"
                    style={{ zIndex: index }}
                  >
                    {item.component}
                  </div>
                ))
              ) : (
                <HomePage />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </SecondaryPageContext.Provider>
    </PrimaryPageContext.Provider>
  )
}

export function SecondaryPageLink({
  to,
  children,
  className,
  onClick
}: {
  to: string
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const { push } = useSecondaryPage()

  return (
    <span
      className={cn('cursor-pointer', className)}
      onClick={(e) => {
        onClick && onClick(e)
        push(to)
      }}
    >
      {children}
    </span>
  )
}

function isCurrentPage(stack: TStackItem[], url: string) {
  const currentPage = stack[stack.length - 1]
  if (!currentPage) return false

  return currentPage.url === url
}

function findAndCreateComponent(url: string) {
  for (const { matcher, element } of routes) {
    const match = matcher(url)
    if (!match) continue

    if (!element) return <NotFoundPage />
    return cloneElement(element, match.params)
  }
  return <NotFoundPage />
}

function pushNewPageToStack(stack: TStackItem[], url: string, maxStackSize = 5) {
  const component = findAndCreateComponent(url)
  const currentStack = stack[stack.length - 1]
  const newItem = { component, url, index: currentStack ? currentStack.index + 1 : 0 }
  const newStack = [...stack, newItem]
  const lastCachedIndex = newStack.findIndex((stack) => stack.component)
  if (newStack.length - lastCachedIndex > maxStackSize) {
    newStack[lastCachedIndex].component = null
  }
  return { newStack, newItem }
}
