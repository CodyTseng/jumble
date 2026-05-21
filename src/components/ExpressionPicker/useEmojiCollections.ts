import { loadNativeEmojiData, TNativeEmojiCategory } from '@/lib/native-emoji-data'
import { customEmojiCollectionsAtom } from '@/services/custom-emoji.service'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'

export function useEmojiCollections() {
  const { standalone, packs } = useAtomValue(customEmojiCollectionsAtom)
  const [nativeCategories, setNativeCategories] = useState<TNativeEmojiCategory[]>([])
  const [nativeLoading, setNativeLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadNativeEmojiData()
      .then((cats) => {
        if (!cancelled) {
          setNativeCategories(cats)
          setNativeLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setNativeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { nativeCategories, nativeLoading, standalone, packs }
}
