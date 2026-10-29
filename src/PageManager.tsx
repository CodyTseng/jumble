import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
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
import DraftBox from './components/DraftBox'
import DraftEditorHost from './components/DraftBox/DraftEditorHost'
import NewPost from './components/NewPost'
import TooManyRelaysAlertDialog from './components/TooManyRelaysAlertDialog'
import { initialPrimaryUrl, primaryPageUrl, readPrimaryPageUrl } from './lib/primary-page-url'
import { NotificationProvider } from './providers/NotificationProvider'
import { useScreenSize } from './providers/ScreenSizeProvider'
import { useTheme } from './providers/ThemeProvider'
import { useUserPreferences } from './providers/UserPreferencesProvider'
import { PRIMARY_PAGE_MAP, PRIMARY_PAGE_REF_MAP, TPrimaryPageName } from './routes/primary'
import { SECONDARY_ROUTES } from './routes/secondary'
import modalManager from './services/modal-manager.service'

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
  element: React.ReactElement | null
  ref: RefObject<TPageRef> | null
  hideBottomBar: boolean
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
  const secondaryStackRef = useRef(secondaryStack)
  secondaryStackRef.current = secondaryStack
  const bottomBarHidden =
    secondaryStack.length > 0 && secondaryStack[secondaryStack.length - 1].hideBottomBar
  const bottomBarOffset = bottomBarHidden ? '0px' : 'calc(env(safe-area-inset-bottom) + 3rem)'
  const { isSmallScreen, isLargeScreen } = useScreenSize()
  const { themeSetting } = useTheme()
  const { enableSingleColumnLayout, sidebarCollapse } = useUserPreferences()
  const ignorePopStateRef = useRef(false)
  const primaryUrlRef = useRef(initialPrimaryUrl(window.location, window.history.state))

  useEffect(() => {
    if (isSmallScreen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        navigatePrimaryPageRef.current('search')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSmallScreen])

  useEffect(() => {
    if (['/npub1', '/nprofile1'].some((prefix) => window.location.pathname.startsWith(prefix))) {
      window.history.replaceState(
        window.history.state,
        '',
        '/users' + window.location.pathname + window.location.search + window.location.hash
      )
    } else if (
      ['/note1', '/nevent1', '/naddr1'].some((prefix) =>
        window.location.pathname.startsWith(prefix)
      )
    ) {
      window.history.replaceState(
        window.history.state,
        '',
        '/notes' + window.location.pathname + window.location.search + window.location.hash
      )
    }
    const restoredPrimary = readPrimaryPageUrl(primaryUrlRef.current)
    setCurrentPrimaryPage(restoredPrimary.page)
    setPrimaryPages((pages) =>
      restoredPrimary.page === 'home'
        ? pages
        : [
            ...pages.filter((p) => p.name !== restoredPrimary.page),
            {
              name: restoredPrimary.page,
              element: PRIMARY_PAGE_MAP[restoredPrimary.page],
              props: restoredPrimary.props
            }
          ]
    )
    const initialState = { ...window.history.state, primaryUrl: primaryUrlRef.current }
    if (!window.history.state?.primaryUrl) {
      window.history.pushState(initialState, '', window.location.href)
    } else {
      window.history.replaceState(initialState, '', window.location.href)
    }
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
          window.history.replaceState(
            {
              ...window.history.state,
              index: newItem.index,
              url,
              primaryUrl: primaryUrlRef.current
            },
            '',
            url
          )
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

      const state = e.state as { index?: number; url?: string; primaryUrl?: string } | null
      if (window.location.pathname === '/') {
        if (secondaryStackRef.current.length) {
          // Closing the detail must not undo a primary-pane change made beside it.
          replacePrimaryHistory()
        } else {
          primaryUrlRef.current =
            window.location.pathname + window.location.search + window.location.hash
        }
        const primary = readPrimaryPageUrl(primaryUrlRef.current)
        setCurrentPrimaryPage(primary.page)
        setPrimaryPages((pages) => [
          ...pages.filter((p) => p.name !== primary.page),
          { name: primary.page, element: PRIMARY_PAGE_MAP[primary.page], props: primary.props }
        ])
        setSecondaryStack([])
        return
      }
      if (!state?.url || state.index === undefined) return
      if (secondaryStackRef.current.length) {
        window.history.replaceState(
          { ...window.history.state, primaryUrl: primaryUrlRef.current },
          ''
        )
      } else if (state.primaryUrl) {
        primaryUrlRef.current = state.primaryUrl
        const primary = readPrimaryPageUrl(state.primaryUrl)
        setCurrentPrimaryPage(primary.page)
        setPrimaryPages((pages) => [
          ...pages.filter((p) => p.name !== primary.page),
          { name: primary.page, element: PRIMARY_PAGE_MAP[primary.page], props: primary.props }
        ])
      }
      const index = state.index
      const url = state.url
      setSecondaryStack((pre) => {
        const currentItem = pre[pre.length - 1] as TStackItem | undefined
        const currentIndex = currentItem?.index
        // Go forward
        if (currentIndex === undefined || index > currentIndex) {
          const { newStack } = pushNewPageToStack(pre, url, maxStackSize, index)
          return newStack
        }

        if (index === currentIndex) {
          return pre
        }

        // Go back
        const newStack = pre.filter((item) => item.index <= index)
        const topItem = newStack[newStack.length - 1] as TStackItem | undefined
        if (!topItem) {
          // Create a new stack item if it's not exist (e.g. when the user refreshes the page, the stack will be empty)
          const { element, ref, hideBottomBar } = findAndCloneElement(url, index)
          if (element) {
            newStack.push({
              index,
              url,
              element,
              ref,
              hideBottomBar: hideBottomBar ?? false
            })
          }
        } else if (!topItem.element) {
          // Load the element if it's not cached
          const { element, ref, hideBottomBar } = findAndCloneElement(topItem.url, index)
          if (element) {
            topItem.element = element
            topItem.ref = ref
            topItem.hideBottomBar = hideBottomBar ?? false
          }
        }
        if (newStack.length === 0) {
          replacePrimaryHistory()
        }
        return newStack
      })
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  const replacePrimaryHistory = () => {
    const { index: _index, url: _url, ...state } = window.history.state ?? {}
    window.history.replaceState(
      { ...state, primaryUrl: primaryUrlRef.current },
      '',
      primaryUrlRef.current
    )
  }

  const navigatePrimaryPage = (page: TPrimaryPageName, props?: any) => {
    const existingProps = primaryPages.find((p) => p.name === page)?.props
    primaryUrlRef.current = primaryPageUrl(primaryUrlRef.current, page, props ?? existingProps)
    if (enableSingleColumnLayout || window.location.pathname === '/') {
      replacePrimaryHistory()
    } else {
      window.history.replaceState(
        { ...window.history.state, primaryUrl: primaryUrlRef.current },
        ''
      )
    }
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

  const navigatePrimaryPageRef = useRef(navigatePrimaryPage)
  navigatePrimaryPageRef.current = navigatePrimaryPage

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
        window.history.pushState(
          { ...window.history.state, index: newItem.index, url, primaryUrl: primaryUrlRef.current },
          '',
          url
        )
      }
      return newStack
    })
  }

  const popSecondaryPage = (delta = -1) => {
    if (secondaryStack.length <= -delta) {
      // back to home page
      replacePrimaryHistory()
      setSecondaryStack([])
    } else {
      window.history.go(delta)
    }
  }

  const clearSecondaryPages = () => {
    if (secondaryStack.length === 0) return
    popSecondaryPage(-secondaryStack.length)
  }

  const isWideSecondaryArticleEditor =
    !enableSingleColumnLayout &&
    isLargeScreen &&
    /^\/articles\/(?:new|[^/]+\/edit)(?:[?#]|$)/.test(secondaryStack.at(-1)?.url ?? '')
  const primaryVisible = !enableSingleColumnLayout || secondaryStack.length === 0
  const panelClassName = !enableSingleColumnLayout
    ? cn(
        'bg-background relative overflow-hidden',
        themeSetting === 'pure-black' ? 'border-s' : 'rounded-2xl'
      )
    : undefined

  // Keep providers, panels and page wrappers in the same tree positions in every mode.
  // Reparenting a cached React element still remounts it and loses its local state.
  return (
    <PrimaryPageContext.Provider
      value={{
        navigate: navigatePrimaryPage,
        current: currentPrimaryPage,
        display: primaryVisible && !isWideSecondaryArticleEditor
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
            <div
              className={cn(
                !enableSingleColumnLayout && 'bg-surface-background flex flex-col items-center',
                isSmallScreen && 'safe-area-x'
              )}
              style={
                {
                  '--bottom-bar-offset': isSmallScreen ? bottomBarOffset : '0px'
                } as React.CSSProperties
              }
            >
              <div
                className={cn(
                  'w-full',
                  !enableSingleColumnLayout && 'bg-surface-background flex h-(--vh) max-w-[1920px]',
                  enableSingleColumnLayout && !isSmallScreen && 'wide:justify-around flex'
                )}
              >
                <div
                  className={cn(
                    'shrink-0',
                    enableSingleColumnLayout &&
                      cn(
                        // Fixed widths use the viewport, so account for the scrollbar
                        // Radix removes (and the physical right margin it adds in RTL).
                        'wide:w-[calc((100%-var(--removed-body-scroll-bar-size,0px)-640px)/2)] pointer-events-none fixed start-0 top-0 z-10 flex h-(--vh) justify-end rtl:start-[var(--removed-body-scroll-bar-size,0px)]',
                        sidebarCollapse ? 'w-16' : 'w-52'
                      ),
                    isSmallScreen && 'hidden'
                  )}
                >
                  <div className="pointer-events-auto h-full">
                    <Sidebar />
                  </div>
                </div>
                <div
                  className={cn(
                    enableSingleColumnLayout && !isSmallScreen ? 'wide:w-full' : 'hidden',
                    sidebarCollapse ? 'w-16' : 'w-52'
                  )}
                />
                <div
                  className={cn(
                    !enableSingleColumnLayout && 'grid w-full min-w-0 grid-cols-2',
                    !enableSingleColumnLayout && themeSetting !== 'pure-black' && 'gap-2 py-2 pe-2',
                    enableSingleColumnLayout &&
                      !isSmallScreen &&
                      'bg-background wide:w-[640px] wide:flex-auto wide:shrink-0 min-h-screen w-0 flex-1 border-x'
                  )}
                >
                  <div
                    id="primary-page-panel"
                    className={cn(
                      panelClassName,
                      !enableSingleColumnLayout && themeSetting !== 'pure-black' && 'shadow-lg'
                    )}
                    style={{ display: primaryVisible ? undefined : 'none' }}
                  >
                    {primaryPages.map(({ name, element, props }) => (
                      <div
                        key={name}
                        className={cn(!enableSingleColumnLayout && 'h-full w-full')}
                        style={{ display: currentPrimaryPage === name ? 'block' : 'none' }}
                      >
                        {props ? cloneElement(element as React.ReactElement, props) : element}
                      </div>
                    ))}
                  </div>
                  <div
                    id="secondary-page-panel"
                    className={cn(
                      panelClassName,
                      !enableSingleColumnLayout && secondaryStack.length === 0 && 'bg-surface',
                      !enableSingleColumnLayout &&
                        themeSetting !== 'pure-black' &&
                        secondaryStack.length > 0 &&
                        'shadow-lg'
                    )}
                    style={{
                      display:
                        enableSingleColumnLayout && !secondaryStack.length ? 'none' : undefined
                    }}
                  >
                    {secondaryStack.map((item, index) => (
                      <div
                        key={item.index}
                        className={cn(!enableSingleColumnLayout && 'h-full w-full')}
                        style={{ display: index === secondaryStack.length - 1 ? 'block' : 'none' }}
                      >
                        {item.element}
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className={cn(
                    enableSingleColumnLayout && !isSmallScreen
                      ? 'wide:block wide:w-full hidden'
                      : 'hidden'
                  )}
                />
              </div>
              {isSmallScreen && !bottomBarHidden && <BottomNavigationBar />}
            </div>
            <TooManyRelaysAlertDialog />
            <BackgroundAudio
              className={cn(
                'fixed end-0 z-50 overflow-hidden',
                isSmallScreen
                  ? 'safe-area-x bg-background bottom-[calc(env(safe-area-inset-bottom)+3rem)] w-full max-w-none rounded-none border-x-0 border-y [--safe-area-padding:0.5rem]'
                  : 'bottom-20 w-80 rounded-s-full rounded-e-none border shadow-lg',
                isSmallScreen && bottomBarHidden && 'hidden'
              )}
            />
            <DraftBox />
            <DraftEditorHost />
            <NewPost />
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

function findAndCloneElement(url: string, index: number) {
  const path = url.split('?')[0].split('#')[0]
  for (const { matcher, element, hideBottomBar } of SECONDARY_ROUTES) {
    const match = matcher(path)
    if (!match) continue

    if (!element) return {}
    const ref = createRef<TPageRef>()
    return {
      element: cloneElement(element, { ...match.params, index, ref } as any),
      ref,
      hideBottomBar
    }
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

  const { element, ref, hideBottomBar } = findAndCloneElement(url, currentIndex)
  if (!element) return { newStack: stack, newItem: null }

  const newItem: TStackItem = {
    element,
    ref,
    url,
    index: currentIndex,
    hideBottomBar: hideBottomBar ?? false
  }
  const newStack = [...stack, newItem]
  const lastCachedIndex = newStack.findIndex((stack) => stack.element)
  // Clear the oldest cached element if there are too many cached elements
  if (newStack.length - lastCachedIndex > maxStackSize) {
    newStack[lastCachedIndex].element = null
  }
  return { newStack, newItem }
}
