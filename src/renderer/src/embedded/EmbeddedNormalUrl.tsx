import { EmbeddedNormalUrl } from '../components/Embedded'
import { TEmbeddedRenderer } from './types'

export const embeddedNormalUrlRenderer: TEmbeddedRenderer = {
  regex: /(https?:\/\/[^\s]+|wss?:\/\/[^\s]+)/g,
  render: (url: string, index: number) => {
    return <EmbeddedNormalUrl key={`normal-url-${index}`} url={url} />
  }
}
