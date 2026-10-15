/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
import { z } from 'zod'

const actionSchema = z
  .object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(160),
    defaultKey: z.string().min(1).max(128).optional()
  })
  .strict()
const forwardedSchema = z.object({
  key: z.string().min(1).max(64),
  code: z.string().max(64),
  ctrl: z.boolean(),
  alt: z.boolean(),
  shift: z.boolean(),
  meta: z.boolean()
})
const modifiers = ['Alt', 'Ctrl', 'Shift', 'Meta']

/** Hints are optional. Never take focus navigation, OS/browser shortcuts or an occupied key. */
export function defaultBinding(hint?: string): string | undefined {
  if (!hint) return
  const selected = new Set<string>()
  let key = hint
  for (;;) {
    const match = /^(Alt|Ctrl|Shift|Meta)\+/.exec(key)
    if (!match) break
    if (selected.has(match[1])) return
    selected.add(match[1])
    key = key.slice(match[0].length)
  }
  if (!key || /[\x00-\x1f\x7f]/.test(key) || (key.includes('+') && key !== '+')) return
  if (['Tab', 'Escape', 'Control', 'Alt', 'Shift', 'Meta', 'Dead', 'Unidentified'].includes(key))
    return
  if (['F1', 'F5', 'F6', 'F11', 'F12'].includes(key)) return
  // The pinned shim orders Meta before Shift, unlike the draft. Leave those
  // combined hints unbound until the upstream normalization agrees; never lie
  // about a binding that the installed shim cannot match.
  if (selected.has('Meta') && selected.has('Shift')) return
  if (
    (selected.has('Ctrl') || selected.has('Meta')) &&
    /^(w|t|l|n|r|q|p|Tab|[+\-=0-9])$/i.test(key)
  )
    return
  if (selected.has('Alt') && ['ArrowLeft', 'ArrowRight', 'Home', 'F4'].includes(key)) return
  if (/^[a-z]$/i.test(key)) key = selected.has('Shift') ? key.toUpperCase() : key.toLowerCase()
  return [...modifiers.filter((m) => selected.has(m)), key].join('+')
}

/** Keyboard bindings belong to a frame, not an account. Bound actions execute in the shim. */
export class NappletKeys {
  private actions = new Map<string, { key?: string }>()
  private alive = true
  private changes = 0
  private changeWindow = 0
  private forwarded = 0
  private forwardWindow = 0
  constructor(
    private options: {
      send: (message: Record<string, unknown>) => void
      focused: () => boolean
      escape?: () => void
    }
  ) {}

  ready() {
    this.push()
  }

  handle(message: Record<string, unknown>) {
    if (!this.alive) return
    if (message.type === 'keys.forward') {
      if (Date.now() - this.forwardWindow >= 1000) {
        this.forwardWindow = Date.now()
        this.forwarded = 0
      }
      if (++this.forwarded > 120 || !this.options.focused()) return
      const parsed = forwardedSchema.safeParse(message)
      if (!parsed.success) return
      const key = parsed.data
      // Call a narrow host command, never synthesize a DOM KeyboardEvent or
      // route user keystrokes into another napplet / privileged host actions.
      if (key.key === 'Escape' && !key.ctrl && !key.alt && !key.shift && !key.meta)
        this.options.escape?.()
      return
    }
    const register = message.type === 'keys.registerAction'
    if (!register && message.type !== 'keys.unregisterAction') return
    if (register && (typeof message.id !== 'string' || !message.id || message.id.length > 128))
      return
    const parsed = register ? actionSchema.safeParse(message.action) : undefined
    const actionId = register ? parsed?.data?.id : message.actionId
    const reply = (error?: string, binding?: string) =>
      this.options.send({
        type: 'keys.registerAction.result',
        id: message.id,
        actionId: typeof actionId === 'string' ? actionId : '',
        ...(error ? { error } : binding ? { binding } : {})
      })
    if (Date.now() - this.changeWindow >= 60000) {
      this.changeWindow = Date.now()
      this.changes = 0
    }
    if (++this.changes > 256) {
      if (register) reply('keyboard registration rate exceeded')
      return
    }
    if (!register) {
      if (typeof actionId === 'string' && this.actions.delete(actionId)) this.push()
      return
    }
    if (!parsed?.success) {
      reply('invalid action')
      return
    }
    const action = parsed.data
    if (this.actions.has(action.id)) {
      reply('duplicate action ID')
      return
    }
    if (this.actions.size >= 128) {
      reply('keyboard action limit exceeded')
      return
    }
    const suggested = defaultBinding(action.defaultKey)
    const key =
      suggested && ![...this.actions.values()].some((a) => a.key === suggested)
        ? suggested
        : undefined
    this.actions.set(action.id, { key })
    // Send bindings first so registerAction's continuation can safely install its callback.
    this.push()
    reply(undefined, key)
  }

  private push() {
    if (this.alive)
      this.options.send({
        type: 'keys.bindings',
        bindings: [...this.actions].flatMap(([actionId, { key }]) =>
          key ? [{ actionId, key }] : []
        )
      })
  }
  close() {
    this.alive = false
    this.actions.clear()
  }
}
