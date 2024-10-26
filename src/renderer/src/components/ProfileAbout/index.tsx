import {
  embedded,
  embeddedHashtagRenderer,
  embeddedNormalUrlRenderer,
  embeddedNostrNpubRenderer
} from '@renderer/embedded'
import { embeddedNpubRenderer } from '@renderer/embedded/EmbeddedNpub'

export default function ProfileAbout({ about }: { about?: string }) {
  const nodes = about
    ? embedded(
        [about],
        [
          embeddedNormalUrlRenderer,
          embeddedHashtagRenderer,
          embeddedNostrNpubRenderer,
          embeddedNpubRenderer
        ]
      )
    : null

  return <>{nodes}</>
}
