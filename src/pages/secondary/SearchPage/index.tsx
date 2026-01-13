import SearchBar, { TSearchBarRef } from '@/components/SearchBar'
import SearchResult from '@/components/SearchResult'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toSearch } from '@/lib/link'
import { parseNakReqCommand } from '@/lib/nak-parser'
import { useSecondaryPage } from '@/PageManager'
import { TSearchParams } from '@/types'
import { ChevronLeft } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'

const SearchPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { push, pop } = useSecondaryPage()
  const [input, setInput] = useState('')
  const searchBarRef = useRef<TSearchBarRef>(null)
  const searchParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('t')
    if (
      type !== 'profile' &&
      type !== 'profiles' &&
      type !== 'notes' &&
      type !== 'hashtag' &&
      type !== 'relay' &&
      type !== 'nak'
    ) {
      return null
    }
    const search = params.get('q')
    if (!search) {
      return null
    }
    const input = params.get('i') ?? ''
    let request = undefined
    if (type === 'nak') {
      try {
        request = parseNakReqCommand(input)
      } catch {
        // ignore invalid request param
      }
    }
    setInput(input || search)
    return { type, search, input, request } as TSearchParams
  }, [])

  useEffect(() => {
    if (!window.location.search) {
      searchBarRef.current?.focus()
    }
  }, [])

  const onSearch = (params: TSearchParams | null) => {
    if (params) {
      push(toSearch(params))
    }
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      titlebar={
        <div className="flex items-center gap-1 h-full">
          <Button variant="ghost" size="titlebar-icon" onClick={() => pop()}>
            <ChevronLeft />
          </Button>
          <SearchBar ref={searchBarRef} input={input} setInput={setInput} onSearch={onSearch} />
        </div>
      }
      displayScrollToTopButton
    >
      <SearchResult searchParams={searchParams} />
    </SecondaryPageLayout>
  )
})
SearchPage.displayName = 'SearchPage'
export default SearchPage
