import Sidebar from '@/components/Sidebar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import NoteListPage from '@/pages/primary/NoteListPage'
import HomePage from '@/pages/secondary/HomePage'
import { TPageRef } from '@/types'
import {
  cloneElement,
  createContext,
  createRef,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import ExplorePage from './pages/primary/ExplorePage'
import MePage from './pages/primary/MePage'
import NotificationListPage from './pages/primary/NotificationListPage'
import { NotificationProvider } from './providers/NotificationProvider'
import { useScreenSize } from './providers/ScreenSizeProvider'
import { routes } from './routes'
import modalManager from './services/modal-manager.service'

export type TPrimaryPageName = keyof typeof PRIMARY_PAGE_MAP

type TPrimaryPageContext = {
  navigate: (page: TPrimaryPageName) => void
  current: TPrimaryPageName | null
  display: boolean
}

type TSecondaryPageContext = {
  push: (url: string) => void
  pop: () => void
  currentIndex: number
}

type TStackItem = {
  index: number
  url: string
  component: React.ReactElement | null
  ref: RefObject<TPageRef> | null
}

const PRIMARY_PAGE_REF_MAP = {
  home: createRef<TPageRef>(),
  explore: createRef<TPageRef>(),
  notifications: createRef<TPageRef>(),
  me: createRef<TPageRef>()
}

const PRIMARY_PAGE_MAP = {
  home: <NoteListPage ref={PRIMARY_PAGE_REF_MAP.home} />,
  explore: <ExplorePage ref={PRIMARY_PAGE_REF_MAP.explore} />,
  notifications: <NotificationListPage ref={PRIMARY_PAGE_REF_MAP.notifications} />,
  me: <MePage ref={PRIMARY_PAGE_REF_MAP.me} />
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
  const [primaryPages, setPrimaryPages] = useState<
    { name: TPrimaryPageName; element: ReactNode }[]
  >([
    {
      name: 'home',
      element: PRIMARY_PAGE_MAP.home
    }
  ])
  const [secondaryStack, setSecondaryStack] = useState<TStackItem[]>([])
  const [isShared, setIsShared] = useState(false)
  const { isSmallScreen } = useScreenSize()
  const ignorePopStateRef = useRef(false)

  useEffect(() => {
    const hasHistoryState = !!history.state
    if (['/npub1', '/nprofile1'].some((prefix) => window.location.pathname.startsWith(prefix))) {
      window.history.replaceState(
        null,
        '',
        '/users' + window.location.pathname + window.location.search + window.location.hash
      )
    } else if (
      ['/note1', '/nevent1', '/naddr1'].some((prefix) =>
        window.location.pathname.startsWith(prefix)
      )
    ) {
      window.history.replaceState(
        null,
        '',
        '/notes' + window.location.pathname + window.location.search + window.location.hash
      )
    }
    window.history.pushState(null, '', window.location.href)
    if (window.location.pathname !== '/') {
      if (
        ['/users', '/notes', '/relays'].some((path) => window.location.pathname.startsWith(path)) &&
        !hasHistoryState
      ) {
        setIsShared(true)
      }
      const url = window.location.pathname + window.location.search + window.location.hash
      setSecondaryStack((prevStack) => {
        if (isCurrentPage(prevStack, url)) return prevStack

        const { newStack, newItem } = pushNewPageToStack(
          prevStack,
          url,
          maxStackSize,
          window.history.state?.index
        )
        if (newItem) {
          window.history.replaceState({ index: newItem.index, url }, '', url)
        }
        return newStack
      })
    }

    const onPopState = (e: PopStateEvent) => {
      if (ignorePopStateRef.current) {
        ignorePopStateRef.current = false
        return
      }

      const closeModal = modalManager.pop()
      if (closeModal) {
        ignorePopStateRef.current = true
        window.history.forward()
        return
      }

      let state = e.state as { index: number; url: string } | null
      setSecondaryStack((pre) => {
        const currentItem = pre[pre.length - 1] as TStackItem | undefined
        const currentIndex = currentItem?.index
        if (!state) {
          if (window.location.pathname + window.location.search + window.location.hash !== '/') {
            // Just change the URL
            return pre
          } else {
            // Back to root
            state = { index: -1, url: '/' }
          }
        }

        // Go forward
        if (currentIndex === undefined || state.index > currentIndex) {
          const { newStack } = pushNewPageToStack(pre, state.url, maxStackSize)
          return newStack
        }

        if (state.index === currentIndex) {
          return pre
        }

        // Go back
        const newStack = pre.filter((item) => item.index <= state!.index)
        const topItem = newStack[newStack.length - 1] as TStackItem | undefined
        if (!topItem) {
          // Create a new stack item if it's not exist (e.g. when the user refreshes the page, the stack will be empty)
          const { component, ref } = findAndCreateComponent(state.url, state.index)
          if (component) {
            newStack.push({
              index: state.index,
              url: state.url,
              component,
              ref
            })
          }
        } else if (!topItem.component) {
          // Load the component if it's not cached
          const { component, ref } = findAndCreateComponent(topItem.url, state.index)
          if (component) {
            topItem.component = component
            topItem.ref = ref
          }
        }
        if (newStack.length === 0) {
          window.history.replaceState(null, '', '/')
        }
        return newStack
      })
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  const navigatePrimaryPage = (page: TPrimaryPageName) => {
    const needScrollToTop = page === currentPrimaryPage
    const exists = primaryPages.find((p) => p.name === page)
    if (!exists) {
      setPrimaryPages((prev) => [...prev, { name: page, element: PRIMARY_PAGE_MAP[page] }])
    }
    setCurrentPrimaryPage(page)
    if (needScrollToTop) {
      PRIMARY_PAGE_REF_MAP[page].current?.scrollToTop()
    }
    if (isSmallScreen) {
      clearSecondaryPages()
    }
  }

  const pushSecondaryPage = (url: string, index?: number) => {
    setSecondaryStack((prevStack) => {
      if (isCurrentPage(prevStack, url)) {
        const currentItem = prevStack[prevStack.length - 1]
        if (currentItem?.ref?.current) {
          currentItem.ref.current.scrollToTop()
        }
        return prevStack
      }

      const { newStack, newItem } = pushNewPageToStack(prevStack, url, maxStackSize, index)
      if (newItem) {
        window.history.pushState({ index: newItem.index, url }, '', url)
      }
      return newStack
    })
  }

  const popSecondaryPage = () => {
    if (secondaryStack.length === 1) {
      // back to home page
      window.history.replaceState(null, '', '/')
      setIsShared(false)
      setSecondaryStack([])
    } else {
      window.history.go(-1)
    }
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
          current: currentPrimaryPage,
          display: secondaryStack.length === 0
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
          <NotificationProvider>
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
            {primaryPages.map(({ name, element }) => (
              <div
                key={name}
                style={{
                  display:
                    secondaryStack.length === 0 && currentPrimaryPage === name ? 'block' : 'none'
                }}
              >
                {element}
              </div>
            ))}
          </NotificationProvider>
        </SecondaryPageContext.Provider>
      </PrimaryPageContext.Provider>
    )
  }

  if (isShared && secondaryStack.length > 0) {
    return (
      <PrimaryPageContext.Provider
        value={{
          navigate: navigatePrimaryPage,
          current: currentPrimaryPage,
          display: false
        }}
      >
        <SecondaryPageContext.Provider
          value={{
            push: pushSecondaryPage,
            pop: popSecondaryPage,
            currentIndex: secondaryStack[secondaryStack.length - 1].index
          }}
        >
          <NotificationProvider>
            <div className="h-screen overflow-hidden max-w-4xl mx-auto border-x">
              {secondaryStack.map((item, index) => (
                <div
                  key={item.index}
                  style={{ display: index === secondaryStack.length - 1 ? 'block' : 'none' }}
                >
                  {item.component}
                </div>
              ))}
            </div>
          </NotificationProvider>
        </SecondaryPageContext.Provider>
      </PrimaryPageContext.Provider>
    )
  }

  return (
    <PrimaryPageContext.Provider
      value={{
        navigate: navigatePrimaryPage,
        current: currentPrimaryPage,
        display: true
      }}
    >
      <SecondaryPageContext.Provider
        value={{
          push: pushSecondaryPage,
          pop: popSecondaryPage,
          currentIndex: secondaryStack.length ? secondaryStack[secondaryStack.length - 1].index : 0
        }}
      >
        <NotificationProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <Separator orientation="vertical" />
            <div className="grid grid-cols-2 w-full">
              <div className="flex border-r">
                {primaryPages.map(({ name, element }) => (
                  <div
                    key={name}
                    className="w-full"
                    style={{
                      display: currentPrimaryPage === name ? 'block' : 'none'
                    }}
                  >
                    {element}
                  </div>
                ))}
              </div>
              <div>
                {secondaryStack.map((item, index) => (
                  <div
                    key={item.index}
                    style={{ display: index === secondaryStack.length - 1 ? 'block' : 'none' }}
                  >
                    {item.component}
                  </div>
                ))}
                <div key="home" style={{ display: secondaryStack.length === 0 ? 'block' : 'none' }}>
                  <HomePage />
                </div>
              </div>
            </div>
          </div>
        </NotificationProvider>
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
  const path = url.split('?')[0].split('#')[0]
  for (const { matcher, element } of routes) {
    const match = matcher(path)
    if (!match) continue

    if (!element) return {}
    const ref = createRef<TPageRef>()
    return { component: cloneElement(element, { ...match.params, index, ref } as any), ref }
  }
  return {}
}

function pushNewPageToStack(
  stack: TStackItem[],
  url: string,
  maxStackSize = 5,
  specificIndex?: number
) {
  const currentItem = stack[stack.length - 1]
  const currentIndex = specificIndex ?? (currentItem ? currentItem.index + 1 : 0)

  const { component, ref } = findAndCreateComponent(url, currentIndex)
  if (!component) return { newStack: stack, newItem: null }

  const newItem = { component, ref, url, index: currentIndex }
  const newStack = [...stack, newItem]
  const lastCachedIndex = newStack.findIndex((stack) => stack.component)
  // Clear the oldest cached component if there are too many cached components
  if (newStack.length - lastCachedIndex > maxStackSize) {
    newStack[lastCachedIndex].component = null
  }
  return { newStack, newItem }
}
