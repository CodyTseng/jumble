import SearchInput from '@/components/SearchInput'
import { useSearchProfiles } from '@/hooks'
import { toNote } from '@/lib/link'
import { randomString } from '@/lib/random'
import { normalizeUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import modalManager from '@/services/modal-manager.service'
import { TSearchParams } from '@/types'
import { Hash, Notebook, Search, Server } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import {
  forwardRef,
  HTMLAttributes,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import UserItem, { UserItemSkeleton } from '../UserItem'

const SearchBar = forwardRef<
  TSearchBarRef,
  {
    input: string
    setInput: (input: string) => void
    onSearch: (params: TSearchParams | null) => void
  }
>(({ input, setInput, onSearch }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const [debouncedInput, setDebouncedInput] = useState(input)
  const { profiles, isFetching: isFetchingProfiles } = useSearchProfiles(debouncedInput, 5)
  const [searching, setSearching] = useState(false)
  const [displayList, setDisplayList] = useState(false)
  const [selectableOptions, setSelectableOptions] = useState<TSearchParams[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedUrl = useMemo(() => {
    if (['w', 'ws', 'ws:', 'ws:/', 'wss', 'wss:', 'wss:/'].includes(input)) {
      return undefined
    }
    try {
      return normalizeUrl(input)
    } catch {
      return undefined
    }
  }, [input])
  const id = useMemo(() => `search-${randomString()}`, [])

  useImperativeHandle(ref, () => ({
    focus: () => {
      searchInputRef.current?.focus()
    },
    blur: () => {
      searchInputRef.current?.blur()
    }
  }))

  useEffect(() => {
    if (!input) {
      onSearch(null)
    }
    setSelectedIndex(-1)
  }, [input])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInput(input)
    }, 500)

    return () => {
      clearTimeout(handler)
    }
  }, [input])

  const blur = () => {
    setSearching(false)
    searchInputRef.current?.blur()
  }

  const updateSearch = (params: TSearchParams) => {
    blur()

    if (params.type === 'note') {
      push(toNote(params.search))
    } else {
      onSearch(params)
    }
  }

  useEffect(() => {
    const search = input.trim()
    if (!search) return

    if (/^[0-9a-f]{64}$/.test(search)) {
      setSelectableOptions([
        { type: 'note', search },
        { type: 'profile', search }
      ])
      return
    }

    try {
      let id = search
      if (id.startsWith('nostr:')) {
        id = id.slice(6)
      }
      const { type } = nip19.decode(id)
      if (['nprofile', 'npub'].includes(type)) {
        setSelectableOptions([{ type: 'profile', search: id }])
        return
      }
      if (['nevent', 'naddr', 'note'].includes(type)) {
        setSelectableOptions([{ type: 'note', search: id }])
        return
      }
    } catch {
      // ignore
    }

    const hashtag = search.match(/[\p{L}\p{N}\p{M}]+/u)?.[0].toLowerCase() ?? ''

    setSelectableOptions([
      { type: 'notes', search },
      { type: 'hashtag', search: hashtag, input: `#${hashtag}` },
      ...(normalizedUrl ? [{ type: 'relay', search: normalizedUrl, input: normalizedUrl }] : []),
      ...profiles.map((profile) => ({
        type: 'profile',
        search: profile.npub,
        input: profile.username
      })),
      ...(profiles.length >= 5 ? [{ type: 'profiles', search }] : [])
    ] as TSearchParams[])
  }, [input, debouncedInput, profiles])

  const list = useMemo(() => {
    if (selectableOptions.length <= 0) {
      return null
    }

    return (
      <>
        {selectableOptions.map((option, index) => {
          if (option.type === 'note') {
            return (
              <NoteItem
                key={index}
                selected={selectedIndex === index}
                id={option.search}
                onClick={() => updateSearch(option)}
              />
            )
          }
          if (option.type === 'profile') {
            return (
              <ProfileItem
                key={index}
                selected={selectedIndex === index}
                userId={option.search}
                onClick={() => updateSearch(option)}
              />
            )
          }
          if (option.type === 'notes') {
            return (
              <NormalItem
                key={index}
                selected={selectedIndex === index}
                search={option.search}
                onClick={() => updateSearch(option)}
              />
            )
          }
          if (option.type === 'hashtag') {
            return (
              <HashtagItem
                key={index}
                selected={selectedIndex === index}
                hashtag={option.search}
                onClick={() => updateSearch(option)}
              />
            )
          }
          if (option.type === 'relay') {
            return (
              <RelayItem
                key={index}
                selected={selectedIndex === index}
                url={option.search}
                onClick={() => updateSearch(option)}
              />
            )
          }
          if (option.type === 'profiles') {
            return (
              <Item
                key={index}
                selected={selectedIndex === index}
                onClick={() => updateSearch(option)}
              >
                <div className="font-semibold">{t('Show more...')}</div>
              </Item>
            )
          }
          return null
        })}
        {isFetchingProfiles && profiles.length < 5 && (
          <div className="px-2">
            <UserItemSkeleton hideFollowButton />
          </div>
        )}
      </>
    )
  }, [selectableOptions, selectedIndex, isFetchingProfiles, profiles])

  useEffect(() => {
    setDisplayList(searching && !!input)
  }, [searching, input])

  useEffect(() => {
    if (displayList && list) {
      modalManager.register(id, () => {
        setDisplayList(false)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [displayList, list])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.stopPropagation()
        if (selectableOptions.length <= 0) {
          return
        }
        onSearch(selectableOptions[selectedIndex >= 0 ? selectedIndex : 0])
        blur()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (selectableOptions.length <= 0) {
          return
        }
        setSelectedIndex((prev) => (prev + 1) % selectableOptions.length)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (selectableOptions.length <= 0) {
          return
        }
        setSelectedIndex((prev) => (prev - 1 + selectableOptions.length) % selectableOptions.length)
        return
      }

      if (e.key === 'Escape') {
        blur()
        return
      }
    },
    [input, onSearch, selectableOptions, selectedIndex]
  )

  return (
    <div className="relative flex gap-1 items-center h-full w-full">
      {displayList && list && (
        <>
          <div
            className={cn(
              'bg-surface-background rounded-b-lg shadow-lg z-50',
              isSmallScreen
                ? 'fixed top-12 inset-x-0'
                : 'absolute top-full -translate-y-1 inset-x-0 pt-1 '
            )}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="h-fit">{list}</div>
          </div>
          <div className="fixed inset-0 w-full h-full" onClick={() => blur()} />
        </>
      )}
      <SearchInput
        ref={searchInputRef}
        className={cn(
          'bg-surface-background shadow-inner h-full border-none',
          searching ? 'z-50' : ''
        )}
        placeholder={t('People, keywords, or relays')}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setSearching(true)}
        onBlur={() => setSearching(false)}
      />
    </div>
  )
})
SearchBar.displayName = 'SearchBar'
export default SearchBar

export type TSearchBarRef = {
  focus: () => void
  blur: () => void
}

function NormalItem({
  search,
  onClick,
  selected
}: {
  search: string
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <Item onClick={onClick} selected={selected}>
      <Search className="text-muted-foreground" />
      <div className="font-semibold truncate">{search}</div>
    </Item>
  )
}

function HashtagItem({
  hashtag,
  onClick,
  selected
}: {
  hashtag: string
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <Item onClick={onClick} selected={selected}>
      <Hash className="text-muted-foreground" />
      <div className="font-semibold truncate">{hashtag}</div>
    </Item>
  )
}

function NoteItem({
  id,
  onClick,
  selected
}: {
  id: string
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <Item onClick={onClick} selected={selected}>
      <Notebook className="text-muted-foreground" />
      <div className="font-semibold truncate">{id}</div>
    </Item>
  )
}

function ProfileItem({
  userId,
  onClick,
  selected
}: {
  userId: string
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <div
      className={cn('px-2 hover:bg-accent rounded-md cursor-pointer', selected && 'bg-accent')}
      onClick={onClick}
    >
      <UserItem
        userId={userId}
        className="pointer-events-none"
        hideFollowButton
        showFollowingBadge
      />
    </div>
  )
}

function RelayItem({
  url,
  onClick,
  selected
}: {
  url: string
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <Item onClick={onClick} selected={selected}>
      <Server className="text-muted-foreground" />
      <div className="font-semibold truncate">{url}</div>
    </Item>
  )
}

function Item({
  className,
  children,
  selected,
  ...props
}: HTMLAttributes<HTMLDivElement> & { selected?: boolean }) {
  return (
    <div
      className={cn(
        'flex gap-2 items-center px-2 py-3 hover:bg-accent rounded-md cursor-pointer',
        selected ? 'bg-accent' : '',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
