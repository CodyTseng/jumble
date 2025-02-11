import { Skeleton } from '@/components/ui/skeleton'
import { toRelay } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import relayInfoService from '@/services/relay-info.service'
import { TNip66RelayInfo } from '@/types'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelaySimpleInfo from '../RelaySimpleInfo'
import SearchInput from '../SearchInput'

export default function RelayList() {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const [loading, setLoading] = useState(true)
  const [relays, setRelays] = useState<TNip66RelayInfo[]>([])
  const [showCount, setShowCount] = useState(20)
  const [input, setInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState(input)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const search = async () => {
      const relayInfos = await relayInfoService.search(debouncedInput)
      setShowCount(20)
      setRelays(relayInfos)
      setLoading(false)
    }
    search()
  }, [debouncedInput])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInput(input)
    }, 1000)

    return () => {
      clearTimeout(handler)
    }
  }, [input])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && showCount < relays.length) {
        setShowCount((prev) => prev + 20)
      }
    }, options)

    const currentBottomRef = bottomRef.current
    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [showCount, relays])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  return (
    <div>
      <div className="px-4 py-2 sticky top-12 bg-background z-30">
        <SearchInput placeholder={t('Search relays')} value={input} onChange={handleInputChange} />
      </div>
      {relays.slice(0, showCount).map((relay) => (
        <RelaySimpleInfo
          key={relay.url}
          relayInfo={relay}
          className="clickable p-4 border-b"
          onClick={(e) => {
            e.stopPropagation()
            push(toRelay(relay.url))
          }}
        />
      ))}
      {showCount < relays.length && <div ref={bottomRef} />}
      {loading && (
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2 w-full">
            <div className="flex flex-1 w-0 items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 w-0 space-y-1">
                <Skeleton className="w-40 h-5" />
                <Skeleton className="w-20 h-4" />
              </div>
            </div>
            <Skeleton className="w-5 h-5 rounded-lg" />
          </div>
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-2/3 h-4" />
        </div>
      )}
      {!loading && relays.length === 0 && (
        <div className="text-center text-muted-foreground text-sm">{t('no relays found')}</div>
      )}
    </div>
  )
}
