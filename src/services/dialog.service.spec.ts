import { getDefaultStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { DialogService } from './dialog.service'

describe('responsive dialog requests', () => {
  it('serializes requests and ignores stale dismissals from a previous surface', async () => {
    const service = new DialogService()
    const store = getDefaultStore()
    const first = service.confirm('First')
    const firstId = store.get(service.requestAtom)!.id
    const second = service.confirm('Second')
    service.respond(firstId, true)
    await expect(first).resolves.toBe(true)
    const secondId = store.get(service.requestAtom)!.id
    service.respond(firstId, false)
    expect(store.get(service.requestAtom)!.id).toBe(secondId)
    service.respond(secondId, false)
    await expect(second).resolves.toBe(false)
    expect(store.get(service.requestAtom)).toBeNull()
  })

  it('preserves empty input separately from cancelling a prompt', async () => {
    const service = new DialogService()
    const store = getDefaultStore()
    const accepted = service.prompt('Name', 'Default')
    expect(store.get(service.requestAtom)).toMatchObject({ defaultValue: 'Default' })
    service.respond(store.get(service.requestAtom)!.id, '')
    await expect(accepted).resolves.toBe('')
    const cancelled = service.prompt('Name')
    service.respond(store.get(service.requestAtom)!.id, null)
    await expect(cancelled).resolves.toBeNull()
  })
})
