import Sidebar from '@renderer/components/Sidebar'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { cn } from '@renderer/lib/utils'
import BlankPage from '@renderer/pages/secondary/BlankPage'
import { match } from 'path-to-regexp'
import { cloneElement, createContext, isValidElement, useContext, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { IS_ELECTRON } from './lib/env'
import { ROUTES } from './routes'

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
  component: React.ReactNode
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
  const navigate = IS_ELECTRON ? () => {} : useNavigate()

  const routes = ROUTES.map(({ path, element }) => ({
    path,
    element: isValidElement(element) ? element : null,
    matcher: match(path)
  }))

  const isCurrentPage = (stack: TStackItem[], url: string) => {
    const currentPage = stack[stack.length - 1]
    if (!currentPage) return false

    return currentPage.url === url
  }

  const refreshPrimary = () => setPrimaryPageKey((prevKey) => prevKey + 1)

  const pushSecondary = (url: string) => {
    if (!IS_ELECTRON) {
      return navigate(url)
    }

    if (isCurrentPage(secondaryStack, url)) return

    for (const { matcher, element } of routes) {
      const match = matcher(url)
      if (!match) continue

      if (!element) return
      const component = cloneElement(element, match.params)
      setSecondaryStack((prevStack) => {
        const currentStack = prevStack[prevStack.length - 1]
        const index = currentStack ? currentStack.index + 1 : 0
        const newStack = [...prevStack, { index, url, component }]
        if (newStack.length > maxStackSize) newStack.shift()
        return newStack
      })
    }
  }

  const popSecondary = () => {
    if (IS_ELECTRON) {
      setSecondaryStack((prevStack) => prevStack.slice(0, -1))
    } else {
      navigate(-1)
    }
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
              {IS_ELECTRON ? (
                secondaryStack.length ? (
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
                  <BlankPage />
                )
              ) : (
                <Outlet />
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
