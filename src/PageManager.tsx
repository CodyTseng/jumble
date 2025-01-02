import Sidebar from '@/components/Sidebar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import NoteListPage from '@/pages/primary/NoteListPage'
import HomePage from '@/pages/secondary/HomePage'
import { cloneElement, createContext, useContext, useEffect, useState } from 'react'
import MePage from './pages/primary/MePage'
import NotificationListPage from './pages/primary/NotificationListPage'
import { useScreenSize } from './providers/ScreenSizeProvider'
import { routes } from './routes'

export type TPrimaryPageName = keyof typeof PRIMARY_PAGE_MAP

type TPrimaryPageContext = {
  navigate: (page: TPrimaryPageName) => void
  current: TPrimaryPageName | null
}

type TSecondaryPageContext = {
  push: (url: string) => void
  pop: () => void
  currentIndex: number
}

type TStackItem = {
  index: number
  url: string
  component: React.ReactNode | null
}

const PRIMARY_PAGE_MAP = {
  home: <NoteListPage />,
  notifications: <NotificationListPage />,
  me: <MePage />
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

export function PageManager({ maxStackSize = 5 }: { maxStackSize?: number }) {
  const [currentPrimaryPage, setCurrentPrimaryPage] = useState<TPrimaryPageName>('home')
  const [secondaryStack, setSecondaryStack] = useState<TStackItem[]>([])
  const { isSmallScreen } = useScreenSize()

  useEffect(() => {
    if (window.location.pathname !== '/') {
      pushSecondaryPage(window.location.pathname + window.location.search)
    }

    const onPopState = (e: PopStateEvent) => {
      const state = e.state ?? { index: -1, url: '/' }
      setSecondaryStack((pre) => {
        const currentItem = pre[pre.length - 1]
        const currentIndex = currentItem ? currentItem.index : 0
        if (state.index === currentIndex) {
          if (currentIndex !== 0) return pre

          window.history.replaceState(null, '', '/')
          return []
        }
        // Go back
        if (state.index < currentIndex) {
          const newStack = pre.filter((item) => item.index <= state.index)
          const topItem = newStack[newStack.length - 1]
          // Load the component if it's not cached
          if (topItem && !topItem.component) {
            topItem.component = findAndCreateComponent(topItem.url, state.index)
          }
          if (newStack.length === 0) {
            window.history.replaceState(null, '', '/')
          }
          return newStack
        }

        // Go forward
        const { newStack } = pushNewPageToStack(pre, state.url, maxStackSize)
        return newStack
      })
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  const navigatePrimaryPage = (page: TPrimaryPageName) => {
    setCurrentPrimaryPage(page)
    if (isSmallScreen) {
      clearSecondaryPages()
    }
  }

  const pushSecondaryPage = (url: string) => {
    setSecondaryStack((prevStack) => {
      if (isCurrentPage(prevStack, url)) return prevStack

      const { newStack, newItem } = pushNewPageToStack(prevStack, url, maxStackSize)
      if (newItem) {
        window.history.pushState({ index: newItem.index, url }, '', url)
      }
      return newStack
    })
  }

  const popSecondaryPage = () => {
    window.history.go(-1)
  }

  const clearSecondaryPages = () => {
    if (secondaryStack.length === 0) return
    window.history.go(-secondaryStack.length)
  }

  if (isSmallScreen) {
    return (
      <PrimaryPageContext.Provider
        value={{
          navigate: navigatePrimaryPage,
          current: secondaryStack.length === 0 ? currentPrimaryPage : null
        }}
      >
        <SecondaryPageContext.Provider
          value={{
            push: pushSecondaryPage,
            pop: popSecondaryPage,
            currentIndex: secondaryStack.length
              ? secondaryStack[secondaryStack.length - 1].index
              : 0
          }}
        >
          {!!secondaryStack.length &&
            secondaryStack.map((item, index) => (
              <div
                key={item.index}
                style={{
                  display: index === secondaryStack.length - 1 ? 'block' : 'none'
                }}
              >
                {item.component}
              </div>
            ))}
          {Object.entries(PRIMARY_PAGE_MAP).map(([pageName, page]) => (
            <div
              key={pageName}
              style={{
                display:
                  secondaryStack.length === 0 && currentPrimaryPage === pageName ? 'block' : 'none'
              }}
            >
              {page}
            </div>
          ))}
        </SecondaryPageContext.Provider>
      </PrimaryPageContext.Provider>
    )
  }

  return (
    <PrimaryPageContext.Provider
      value={{
        navigate: navigatePrimaryPage,
        current: currentPrimaryPage
      }}
    >
      <SecondaryPageContext.Provider
        value={{
          push: pushSecondaryPage,
          pop: popSecondaryPage,
          currentIndex: secondaryStack.length ? secondaryStack[secondaryStack.length - 1].index : 0
        }}
      >
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <Separator orientation="vertical" />
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel minSize={30}>
              <div
                style={{
                  display: !currentPrimaryPage || currentPrimaryPage === 'home' ? 'block' : 'none'
                }}
              >
                <NoteListPage />
              </div>
              <div style={{ display: currentPrimaryPage === 'notifications' ? 'block' : 'none' }}>
                <NotificationListPage />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={30}>
              {secondaryStack.length ? (
                secondaryStack.map((item, index) => (
                  <div
                    key={item.index}
                    style={{ display: index === secondaryStack.length - 1 ? 'block' : 'none' }}
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
        if (onClick) {
          onClick(e)
        }
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

function findAndCreateComponent(url: string, index: number) {
  const path = url.split('?')[0]
  for (const { matcher, element } of routes) {
    const match = matcher(path)
    if (!match) continue

    if (!element) return null
    return cloneElement(element, { ...match.params, index } as any)
  }
  return null
}

function pushNewPageToStack(stack: TStackItem[], url: string, maxStackSize = 5) {
  const currentItem = stack[stack.length - 1]
  const currentIndex = currentItem ? currentItem.index + 1 : 0

  const component = findAndCreateComponent(url, currentIndex)
  if (!component) return { newStack: stack, newItem: null }

  const newItem = { component, url, index: currentItem ? currentItem.index + 1 : 0 }
  const newStack = [...stack, newItem]
  const lastCachedIndex = newStack.findIndex((stack) => stack.component)
  // Clear the oldest cached component if there are too many cached components
  if (newStack.length - lastCachedIndex > maxStackSize) {
    newStack[lastCachedIndex].component = null
  }
  return { newStack, newItem }
}
