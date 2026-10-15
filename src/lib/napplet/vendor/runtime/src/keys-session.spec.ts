import { expect, test } from 'vitest'
import { defaultBinding, NappletKeys } from './keys-session'

function fixture() {
  const sent: Record<string, any>[] = []
  let focused = true,
    exits = 0
  const keys = new NappletKeys({
    send: (m) => sent.push(m),
    focused: () => focused,
    escape: () => exits++
  })
  const register = (id: string, defaultKey?: string) => {
    keys.handle({
      type: 'keys.registerAction',
      id: 'request-' + id,
      action: { id, label: id, defaultKey }
    })
    return sent.at(-1)
  }
  return { keys, sent, register, focus: (value: boolean) => (focused = value), exits: () => exits }
}

test('keys registration returns correlation, pushes complete bindings, and isolates conflicts and frame lifetimes', () => {
  const { keys, sent, register } = fixture()
  keys.ready()
  expect(sent.pop()).toEqual({ type: 'keys.bindings', bindings: [] })
  expect(register('hop', 'ArrowUp')).toEqual({
    type: 'keys.registerAction.result',
    id: 'request-hop',
    actionId: 'hop',
    binding: 'ArrowUp'
  })
  expect(sent.at(-2)).toEqual({
    type: 'keys.bindings',
    bindings: [{ actionId: 'hop', key: 'ArrowUp' }]
  })
  expect(register('hop', 'ArrowLeft')?.error).toBe('duplicate action ID')
  expect(register('conflict', 'ArrowUp')).not.toHaveProperty('binding')
  expect(register('later')).not.toHaveProperty('binding')
  keys.handle({ type: 'keys.unregisterAction', actionId: 'hop' })
  expect(sent.at(-1)).toEqual({ type: 'keys.bindings', bindings: [] })
  expect(register('new-hop', 'ArrowUp')?.binding).toBe('ArrowUp')
  const other = fixture()
  expect(other.register('new-hop', 'ArrowUp')?.binding).toBe('ArrowUp')
  keys.close()
  const count = sent.length
  register('closed', 'z')
  keys.ready()
  expect(sent).toHaveLength(count)
})

test('keyboard defaults normalize hints and leave accessibility, browser and incompatible combinations unbound', () => {
  expect(defaultBinding('Ctrl+Alt+S')).toBe('Alt+Ctrl+s')
  expect(defaultBinding('Shift+Ctrl+s')).toBe('Ctrl+Shift+S')
  expect(defaultBinding('ArrowUp')).toBe('ArrowUp')
  expect(defaultBinding('+')).toBe('+')
  expect(defaultBinding(' ')).toBe(' ')
  for (const value of [
    'Tab',
    'Shift+Tab',
    'Escape',
    'Ctrl+W',
    'Meta+l',
    'Alt+ArrowLeft',
    'F5',
    'Meta+Shift+x',
    'Ctrl+Ctrl+a',
    'Ctrl+',
    'a\n'
  ])
    expect(defaultBinding(value), value).toBeUndefined()
})

test('invalid and excessive registrations fail promptly; forwarded typing cannot exhaust registration budget', () => {
  const { keys, sent, register } = fixture()
  keys.handle({
    type: 'keys.registerAction',
    id: 'bad',
    action: { id: 'too-big', label: 'x'.repeat(161) }
  })
  expect(sent.at(-1)).toMatchObject({ id: 'bad', error: 'invalid action' })
  for (let i = 0; i < 1000; i++)
    keys.handle({
      type: 'keys.forward',
      key: 'x',
      code: 'KeyX',
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    })
  expect(register('valid', 'x')?.binding).toBe('x')
  for (let i = 0; i < 127; i++) register('action-' + i)
  expect(register('overflow')?.error).toBe('keyboard action limit exceeded')
  for (let i = 0; i < 256; i++) register('rate')
  expect(sent.at(-1)).toMatchObject({
    id: 'request-rate',
    error: 'keyboard registration rate exceeded'
  })
})

test('forwarding only invokes the focused shell escape command, never arbitrary actions or malformed keys', () => {
  const { keys, focus, exits } = fixture()
  const escape = {
    type: 'keys.forward',
    key: 'Escape',
    code: 'Escape',
    ctrl: false,
    alt: false,
    shift: false,
    meta: false
  }
  focus(false)
  keys.handle(escape)
  expect(exits()).toBe(0)
  focus(true)
  keys.handle({ ...escape, ctrl: true })
  keys.handle({ ...escape, meta: undefined })
  keys.handle({ ...escape, key: 'a' })
  expect(exits()).toBe(0)
  keys.handle(escape)
  expect(exits()).toBe(1)
  keys.close()
  keys.handle(escape)
  expect(exits()).toBe(1)
})
