import { atom, getDefaultStore } from 'jotai'

type TDialogRequest = { id: number; message: string } & (
  | { type: 'confirm'; resolve: (value: boolean) => void }
  | { type: 'prompt'; defaultValue: string; resolve: (value: string | null) => void }
)

/** Queued, responsive replacements for the browser's blocking confirm/prompt. */
export class DialogService {
  readonly requestAtom = atom<TDialogRequest | null>(null)
  private store = getDefaultStore()
  private pending: TDialogRequest[] = []
  private nextId = 0

  confirm(message: string): Promise<boolean> {
    return new Promise((resolve) =>
      this.enqueue({ id: ++this.nextId, type: 'confirm', message, resolve })
    )
  }

  prompt(message: string, defaultValue = ''): Promise<string | null> {
    return new Promise((resolve) =>
      this.enqueue({ id: ++this.nextId, type: 'prompt', message, defaultValue, resolve })
    )
  }

  respond(id: number, value: boolean | string | null) {
    const request = this.store.get(this.requestAtom)
    // Closing a previous surface must not dismiss the next queued request.
    if (!request || request.id !== id) return
    if (request.type === 'confirm') request.resolve(value === true)
    else request.resolve(typeof value === 'string' ? value : null)
    this.store.set(this.requestAtom, this.pending.shift() ?? null)
  }

  private enqueue(request: TDialogRequest) {
    if (this.store.get(this.requestAtom)) this.pending.push(request)
    else this.store.set(this.requestAtom, request)
  }
}

export default new DialogService()
