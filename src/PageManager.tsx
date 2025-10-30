import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import NoteListPage from '@/pages/primary/NoteListPage'
import HomePage from '@/pages/secondary/HomePage'
import { CurrentRelaysProvider } from '@/providers/CurrentRelaysProvider'
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
import BackgroundAudio from './components/BackgroundAudio'
import BottomNavigationBar from './components/BottomNavigationBar'
import CreateWalletGuideToast from './components/CreateWalletGuideToast'
import TooManyRelaysAlertDialog from './components/TooManyRelaysAlertDialog'
import { normalizeUrl } from './lib/url'
import BookmarkPage from './pages/primary/BookmarkPage'
import ExplorePage from './pages/primary/ExplorePage'
import MePage from './pages/primary/MePage'
import NotificationListPage from './pages/primary/NotificationListPage'
import ProfilePage from './pages/primary/ProfilePage'
import RelayPage from './pages/primary/RelayPage'
import SearchPage from './pages/primary/SearchPage'
import SettingsPage from './pages/primary/SettingsPage'
import { NotificationProvider } from './providers/NotificationProvider'
import { useScreenSize } from './providers/ScreenSizeProvider'
import { useTheme } from './providers/ThemeProvider'
import { useUserPreferences } from './providers/UserPreferencesProvider'
import { routes } from './routes'
import modalManager from './services/modal-manager.service'

export type TPrimaryPageName = keyof typeof PRIMARY_PAGE_MAP

type TPrimaryPageContext = {
  navigate: (page: TPrimaryPageName, props?: object) => void
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
  me: createRef<TPageRef>(),
  profile: createRef<TPageRef>(),
  relay: createRef<TPageRef>(),
  search: createRef<TPageRef>(),
  bookmark: createRef<TPageRef>(),
  settings: createRef<TPageRef>()
}

const PRIMARY_PAGE_MAP = {
  home: <NoteListPage ref={PRIMARY_PAGE_REF_MAP.home} />,
  explore: <ExplorePage ref={PRIMARY_PAGE_REF_MAP.explore} />,
  notifications: <NotificationListPage ref={PRIMARY_PAGE_REF_MAP.notifications} />,
  me: <MePage ref={PRIMARY_PAGE_REF_MAP.me} />,
  profile: <ProfilePage ref={PRIMARY_PAGE_REF_MAP.profile} />,
  relay: <RelayPage ref={PRIMARY_PAGE_REF_MAP.relay} />,
  search: <SearchPage ref={PRIMARY_PAGE_REF_MAP.search} />,
  bookmark: <BookmarkPage ref={PRIMARY_PAGE_REF_MAP.bookmark} />,
  settings: <SettingsPage ref={PRIMARY_PAGE_REF_MAP.settings} />
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
    { name: TPrimaryPageName; element: ReactNode; props?: any }[]
  >([
    {
      name: 'home',
      element: PRIMARY_PAGE_MAP.home
    }
  ])
  const [secondaryStack, setSecondaryStack] = useState<TStackItem[]>([])
  const { isSmallScreen } = useScreenSize()
  const { themeSetting } = useTheme()
  const { enableSingleColumnLayout } = useUserPreferences()
  const ignorePopStateRef = useRef(false)

  useEffect(() => {
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
    } else {
      const searchParams = new URLSearchParams(window.location.search)
      const r = searchParams.get('r')
      if (r) {
        const url = normalizeUrl(r)
        if (url) {
          navigatePrimaryPage('relay', { url })
        }
      }
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

  const navigatePrimaryPage = (page: TPrimaryPageName, props?: any) => {
    const needScrollToTop = page === currentPrimaryPage
    setPrimaryPages((prev) => {
      const exists = prev.find((p) => p.name === page)
      if (exists && props) {
        exists.props = props
        return [...prev]
      } else if (!exists) {
        return [...prev, { name: page, element: PRIMARY_PAGE_MAP[page], props }]
      }
      return prev
    })
    setCurrentPrimaryPage(page)
    if (needScrollToTop) {
      PRIMARY_PAGE_REF_MAP[page].current?.scrollToTop('smooth')
    }
    if (enableSingleColumnLayout) {
      clearSecondaryPages()
    }
  }

  const pushSecondaryPage = (url: string, index?: number) => {
    setSecondaryStack((prevStack) => {
      if (isCurrentPage(prevStack, url)) {
        const currentItem = prevStack[prevStack.length - 1]
        if (currentItem?.ref?.current) {
          currentItem.ref.current.scrollToTop('instant')
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

  const popSecondaryPage = (delta = -1) => {
    if (secondaryStack.length <= -delta) {
      // back to home page
      window.history.replaceState(null, '', '/')
      setSecondaryStack([])
    } else {
      window.history.go(delta)
    }
  }

  const clearSecondaryPages = () => {
    if (secondaryStack.length === 0) return
    popSecondaryPage(-secondaryStack.length)
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
          <CurrentRelaysProvider>
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
              {primaryPages.map(({ name, element, props }) => (
                <div
                  key={name}
                  style={{
                    display:
                      secondaryStack.length === 0 && currentPrimaryPage === name ? 'block' : 'none'
                  }}
                >
                  {props ? cloneElement(element as React.ReactElement, props) : element}
                </div>
              ))}
              <BottomNavigationBar />
              <TooManyRelaysAlertDialog />
              <CreateWalletGuideToast />
            </NotificationProvider>
          </CurrentRelaysProvider>
        </SecondaryPageContext.Provider>
      </PrimaryPageContext.Provider>
    )
  }

  if (enableSingleColumnLayout) {
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
          <CurrentRelaysProvider>
            <NotificationProvider>
              <div className="flex lg:justify-around w-full">
                <div className="sticky top-0 lg:w-full flex justify-end self-start h-[var(--vh)]">
                  <Sidebar />
                </div>
                <div className="flex-1 w-0 bg-background border-x lg:flex-auto lg:w-[640px] lg:shrink-0">
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
                  {primaryPages.map(({ name, element, props }) => (
                    <div
                      key={name}
                      style={{
                        display:
                          secondaryStack.length === 0 && currentPrimaryPage === name
                            ? 'block'
                            : 'none'
                      }}
                    >
                      {props ? cloneElement(element as React.ReactElement, props) : element}
                    </div>
                  ))}
                </div>
                <div className="hidden lg:w-full lg:block" />
              </div>
              <TooManyRelaysAlertDialog />
              <CreateWalletGuideToast />
              <BackgroundAudio className="fixed bottom-20 right-0 z-50 w-80 rounded-l-full rounded-r-none overflow-hidden shadow-lg border" />
            </NotificationProvider>
          </CurrentRelaysProvider>
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
        <CurrentRelaysProvider>
          <NotificationProvider>
            <div className="flex flex-col items-center bg-surface-background">
              <div
                className="flex h-[var(--vh)] w-full bg-surface-background"
                style={{
                  maxWidth: '1920px'
                }}
              >
                <Sidebar />
                <div
                  className={cn(
                    'grid grid-cols-2 w-full',
                    themeSetting === 'pure-black' ? '' : 'gap-2 pr-2 py-2'
                  )}
                >
                  <div
                    className={cn(
                      'bg-background overflow-hidden',
                      themeSetting === 'pure-black' ? 'border-l' : 'rounded-lg shadow-lg'
                    )}
                  >
                    {primaryPages.map(({ name, element, props }) => (
                      <div
                        key={name}
                        className="flex flex-col h-full w-full"
                        style={{
                          display: currentPrimaryPage === name ? 'block' : 'none'
                        }}
                      >
                        {props ? cloneElement(element as React.ReactElement, props) : element}
                      </div>
                    ))}
                  </div>
                  <div
                    className={cn(
                      'bg-background overflow-hidden',
                      themeSetting === 'pure-black' ? 'border-l' : 'rounded-lg shadow-lg'
                    )}
                  >
                    {secondaryStack.map((item, index) => (
                      <div
                        key={item.index}
                        className="flex flex-col h-full w-full"
                        style={{ display: index === secondaryStack.length - 1 ? 'block' : 'none' }}
                      >
                        {item.component}
                      </div>
                    ))}
                    <div
                      key="home"
                      className="w-full"
                      style={{ display: secondaryStack.length === 0 ? 'block' : 'none' }}
                    >
                      <HomePage />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <TooManyRelaysAlertDialog />
            <CreateWalletGuideToast />
            <BackgroundAudio className="fixed bottom-20 right-0 z-50 w-80 rounded-l-full rounded-r-none overflow-hidden shadow-lg border" />
          </NotificationProvider>
        </CurrentRelaysProvider>
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
