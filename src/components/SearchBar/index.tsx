import SearchInput from '@/components/SearchInput'
import { useSearchProfiles } from '@/hooks'
import { toExternalContent, toNote } from '@/lib/link'
import { isNamecoinIdentifier, resolveNamecoin } from '@/lib/namecoin'
import { formatFeedRequest, parseNakReqCommand } from '@/lib/nak-parser'
import { randomString } from '@/lib/random'
import { normalizeUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import modalManager from '@/services/modal-manager.service'
import { TSearchParams } from '@/types'
import { Hash, MessageSquare, Notebook, Search, Server, ShieldCheck, Terminal } from 'lucide-react'
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
  const isIdSearch = useMemo(() => {
    const search = debouncedInput.trim()
    if (!search) return false
    if (/^[0-9a-f]{64}$/.test(search)) return true
    const id = search.startsWith('nostr:') ? search.slice(6) : search
    return /^(npub1|nprofile1|note1|nevent1|naddr1)/.test(id)
  }, [debouncedInput])
  const isNmcSearch = useMemo(() => isNamecoinIdentifier(debouncedInput.trim()), [debouncedInput])
  const [nmcResolvedPubkey, setNmcResolvedPubkey] = useState<string | null>(null)
  const [isResolvingNmc, setIsResolvingNmc] = useState(false)
  const { profiles, isFetching: isFetchingProfiles } = useSearchProfiles(
    isIdSearch || isNmcSearch ? '' : debouncedInput,
    5
  )

  // Resolve Namecoin identifiers
  useEffect(() => {
    if (!isNmcSearch) {
      setNmcResolvedPubkey(null)
      setIsResolvingNmc(false)
      return
    }
    setIsResolvingNmc(true)
    resolveNamecoin(debouncedInput.trim()).then((result) => {
      setNmcResolvedPubkey(result?.pubkey ?? null)
      setIsResolvingNmc(false)
    }).catch(() => {
      setNmcResolvedPubkey(null)
      setIsResolvingNmc(false)
    })
  }, [debouncedInput, isNmcSearch])
  const [searching, setSearching] = useState(false)
  const [displayList, setDisplayList] = useState(false)
  const [selectableOptions, setSelectableOptions] = useState<TSearchParams[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedUrl = useMemo(() => {
    if (['w', 'ws', 'ws:', 'ws:/', 'wss', 'wss:', 'wss:/'].includes(input)) {
      return undefined
    }
    if (!input.includes('.')) {
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
    } else if (params.type === 'externalContent') {
      push(toExternalContent(params.search))
    } else {
      onSearch(params)
    }
  }

  useEffect(() => {
    const search = input.trim()
    if (!search) return

    // Check if input is a nak req command
    const request = parseNakReqCommand(search)
    if (request) {
      setSelectableOptions([
        {
          type: 'nak',
          search: formatFeedRequest(request),
          request,
          input: search
        }
      ])
      return
    }

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

    // Namecoin identifier resolved to a pubkey
    if (isNmcSearch && nmcResolvedPubkey) {
      const npub = nip19.npubEncode(nmcResolvedPubkey)
      setSelectableOptions([{ type: 'profile', search: npub, input: search }])
      return
    }
    if (isNmcSearch && isResolvingNmc) {
      setSelectableOptions([])
      return
    }
    if (isNmcSearch && !nmcResolvedPubkey) {
      // Namecoin name not found, show as text search
      setSelectableOptions([{ type: 'notes', search }])
      return
    }

    const hashtag = search.match(/[\p{L}\p{N}\p{M}]+/u)?.[0].toLowerCase() ?? ''

    setSelectableOptions([
      { type: 'notes', search },
      ...(normalizedUrl ? [{ type: 'relay', search: normalizedUrl, input: normalizedUrl }] : []),
      { type: 'externalContent', search, input },
      { type: 'hashtag', search: hashtag, input: `#${hashtag}` },
      ...profiles.map((profile) => ({
        type: 'profile',
        search: profile.npub,
        input: profile.username
      })),
      ...(profiles.length >= 5 ? [{ type: 'profiles', search }] : [])
    ] as TSearchParams[])
  }, [input, debouncedInput, profiles, isNmcSearch, nmcResolvedPubkey, isResolvingNmc])

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
          if (option.type === 'externalContent') {
            return (
              <ExternalContentItem
                key={index}
                selected={selectedIndex === index}
                search={option.search}
                onClick={() => updateSearch(option)}
              />
            )
          }
          if (option.type === 'nak') {
            return (
              <NakItem
                key={index}
                selected={selectedIndex === index}
                description={option.search}
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
        {isResolvingNmc && (
          <Item>
            <div className="flex size-10 items-center justify-center">
              <ShieldCheck className="flex-shrink-0 animate-pulse text-teal-500" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="truncate font-semibold">{debouncedInput.trim()}</div>
              <div className="text-sm text-muted-foreground">{t('Resolving Namecoin name...')}</div>
            </div>
          </Item>
        )}
        {isFetchingProfiles && profiles.length < 5 && (
          <div className="px-2">
            <UserItemSkeleton hideFollowButton />
          </div>
        )}
      </>
    )
  }, [selectableOptions, selectedIndex, isFetchingProfiles, profiles, isResolvingNmc, debouncedInput])

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
    <div className="relative flex h-full w-full items-center gap-1">
      {displayList && list && (
        <>
          <div
            className={cn(
              'z-50 rounded-b-lg bg-surface-background shadow-lg',
              isSmallScreen
                ? 'fixed inset-x-0 top-12'
                : 'absolute inset-x-0 top-full -translate-y-2 border px-1 pb-1 pt-3.5'
            )}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="h-fit">{list}</div>
          </div>
          <div className="fixed inset-0 h-full w-full" onClick={() => blur()} />
        </>
      )}
      <SearchInput
        ref={searchInputRef}
        className={cn(
          'h-full border-transparent bg-surface-background shadow-inner',
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
  const { t } = useTranslation()
  return (
    <Item onClick={onClick} selected={selected}>
      <div className="flex size-10 items-center justify-center">
        <Search className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate font-semibold">{search}</div>
        <div className="text-sm text-muted-foreground">{t('Search for notes')}</div>
      </div>
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
  const { t } = useTranslation()
  return (
    <Item onClick={onClick} selected={selected}>
      <div className="flex size-10 items-center justify-center">
        <Hash className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate font-semibold">#{hashtag}</div>
        <div className="text-sm text-muted-foreground">{t('Search for hashtag')}</div>
      </div>
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
  const { t } = useTranslation()
  return (
    <Item onClick={onClick} selected={selected}>
      <div className="flex size-10 items-center justify-center">
        <Notebook className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate font-mono text-sm font-semibold">{id}</div>
        <div className="text-sm text-muted-foreground">{t('Go to note')}</div>
      </div>
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
      className={cn('cursor-pointer rounded-md px-2 hover:bg-accent', selected && 'bg-accent')}
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
  const { t } = useTranslation()
  return (
    <Item onClick={onClick} selected={selected}>
      <div className="flex size-10 items-center justify-center">
        <Server className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate font-semibold">{url}</div>
        <div className="text-sm text-muted-foreground">{t('Go to relay')}</div>
      </div>
    </Item>
  )
}

function ExternalContentItem({
  search,
  onClick,
  selected
}: {
  search: string
  onClick?: () => void
  selected?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Item onClick={onClick} selected={selected}>
      <div className="flex size-10 items-center justify-center">
        <MessageSquare className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate font-semibold">{search}</div>
        <div className="text-sm text-muted-foreground">{t('View discussions about this')}</div>
      </div>
    </Item>
  )
}

function NakItem({
  description,
  onClick,
  selected
}: {
  description: string
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <Item onClick={onClick} selected={selected}>
      <div className="flex size-10 items-center justify-center">
        <Terminal className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate font-semibold">REQ</div>
        <div className="truncate text-sm text-muted-foreground">{description}</div>
      </div>
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
        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent',
        selected ? 'bg-accent' : '',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
