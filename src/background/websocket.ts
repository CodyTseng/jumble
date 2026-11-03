// Browser-compatible transport surface. Nostr protocol/retry/verification stay in SmartPool.
const sockets = new Map<number, NativeWebSocket>()
let nextSocket = 0
const send = (message: object) => window.JumbleBackgroundHost.postMessage(JSON.stringify(message))
export class NativeWebSocket extends EventTarget {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readonly id = ++nextSocket
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3
  bufferedAmount = 0
  extensions = ''
  protocol = ''
  binaryType: BinaryType = 'blob'
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  constructor(readonly url: string) {
    super()
    sockets.set(this.id, this)
    send({ op: 'socketOpen', socketId: this.id, url })
  }
  send(data: string) {
    if (this.readyState !== 1) throw new DOMException('Socket is not open', 'InvalidStateError')
    send({ op: 'socketSend', socketId: this.id, data })
  }
  close(code = 1000, reason = '') {
    if (this.readyState >= 2) return
    this.readyState = 2
    send({ op: 'socketClose', socketId: this.id, code, reason })
  }
}
export function deliverSocket(
  id: number,
  event: { type: string; data?: string; code?: number; reason?: string }
) {
  const socket = sockets.get(id)
  if (!socket) return
  if (event.type === 'open' && socket.readyState === 0) {
    socket.readyState = 1
    socket.onopen?.(new Event('open'))
  }
  if (event.type === 'message')
    socket.onmessage?.(new MessageEvent('message', { data: event.data }))
  if (event.type === 'error') socket.onerror?.(new Event('error'))
  if (event.type === 'close' && socket.readyState !== 3) {
    socket.readyState = 3
    sockets.delete(id)
    socket.onclose?.(
      new CloseEvent('close', {
        code: event.code ?? 1006,
        reason: event.reason ?? '',
        wasClean: event.code === 1000
      })
    )
  }
}

export const socketUrl = (id: number) => sockets.get(id)?.url
