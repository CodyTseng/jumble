import { useEffect, useRef, useState } from 'react'
import UserItem from '../UserItem'

export default function ProfileList({ pubkeys }: { pubkeys: string[] }) {
  const [visiblePubkeys, setVisiblePubkeys] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisiblePubkeys(pubkeys.slice(0, 10))
  }, [pubkeys])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && pubkeys.length > visiblePubkeys.length) {
        setVisiblePubkeys((prev) => [...prev, ...pubkeys.slice(prev.length, prev.length + 10)])
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
  }, [visiblePubkeys, pubkeys])

  return (
    <div className="px-4 pt-2">
      {visiblePubkeys.map((pubkey, index) => (
        <UserItem key={`${index}-${pubkey}`} userId={pubkey} />
      ))}
      {pubkeys.length > visiblePubkeys.length && <div ref={bottomRef} />}
    </div>
  )
}
