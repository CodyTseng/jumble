import {
  embedded,
  embeddedHashtagRenderer,
  embeddedNormalUrlRenderer,
  embeddedNostrNpubRenderer
} from '@renderer/embedded'
import { embeddedNpubRenderer } from '@renderer/embedded/EmbeddedNpub'
import { useMemo } from 'react'

export default function ProfileAbout({ about }: { about?: string }) {
  const nodes = useMemo(() => {
    return about
      ? embedded(about, [
          embeddedNormalUrlRenderer,
          embeddedHashtagRenderer,
          embeddedNostrNpubRenderer,
          embeddedNpubRenderer
        ])
      : null
  }, [about])

  return <>{nodes}</>
}
