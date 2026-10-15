import { expect, it } from 'vitest'
import { nappletCarrierUrl } from './carrier'

it('resolves the carrier from deep Web and Electron routes without invoking the SPA fallback', () => {
  expect(nappletCarrierUrl('./', 'app://renderer/napplets/nevent123')).toBe(
    'app://renderer/napplet-host.html'
  )
  expect(nappletCarrierUrl('/', 'https://jumble.example/napplets/nevent123')).toBe(
    'https://jumble.example/napplet-host.html'
  )
  expect(nappletCarrierUrl('/client/', 'https://jumble.example/client/napplets/nevent123')).toBe(
    'https://jumble.example/client/napplet-host.html'
  )
})
