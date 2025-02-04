import { Input } from '@/components/ui/input'
import relayInfoService from '@/services/relay-info.service'
import { TNip66RelayInfo } from '@/types'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayCard from './RelayCard'

export default function RelayList() {
  const { t } = useTranslation()
  const [relays, setRelays] = useState<TNip66RelayInfo[]>([])
  const [showCount, setShowCount] = useState(20)
  const [input, setInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState(input)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const relayInfos = await relayInfoService.search(debouncedInput)
      setShowCount(20)
      setRelays(relayInfos)
    }
    init()
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
      <div className="px-4 pb-2 sticky top-12 bg-background z-50">
        <Input placeholder={t('Search relays')} value={input} onChange={handleInputChange} />
      </div>
      {relays.slice(0, showCount).map((relay) => (
        <RelayCard key={relay.url} relayInfo={relay} />
      ))}
      {showCount < relays.length && <div ref={bottomRef} />}
    </div>
  )
}
