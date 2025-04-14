import { TEmbeddedRenderer } from './types'

export function EmbeddedNormalUrl({ url }: { url: string }) {
  return (
    <a
      className="text-primary hover:underline"
      href={url}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      rel="noreferrer"
    >
      {url}
    </a>
  )
}

export const embeddedNormalUrlRenderer: TEmbeddedRenderer = {
  regex: /(https?:\/\/[\w\p{L}\p{N}\p{M}&.-/?=#\-@%+_:!~*]+)/gu,
  render: (url: string, index: number) => {
    return <EmbeddedNormalUrl key={`normal-url-${index}-${url}`} url={url} />
  }
}
