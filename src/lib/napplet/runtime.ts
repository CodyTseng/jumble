import type { TFunction } from 'i18next'
import shim from '@napplet/shim/prelude.global?raw'
import type { Event } from 'nostr-tools'
import type { ISigner } from '@/types'
import { nappletTitle, isNapplet } from '.'
import { accountStorage } from './storage'
import { attachNappletHost, type HostPrompt } from './vendor/runtime/src/host'
import { loadArtifact } from './vendor/runtime/src'
import { preparePlayback } from './vendor/runtime/src/playback'
import { nappletPrelude } from './vendor/runtime/src/prelude'
import { IntentWorkspace, type IntentEntry } from './vendor/runtime/src/intent-session'
import { ProtocolClient } from './vendor/client/src/nostr'
import type { NappletConfig } from './vendor/runtime/src/config-session'
import type { NappletMedia } from './vendor/runtime/src/media-session'
import type { ExportFile } from './vendor/runtime/src/filesystem'
import type { ThemeSource } from './vendor/runtime/src/appearance'
import { declaredConfig } from './vendor/runtime/src/config-schema'
import { registerNappletSession } from './session'

export type RuntimeOptions = {
  event: Event
  translate: TFunction
  frame: HTMLIFrameElement
  messageTarget: Window
  send: (message: Record<string, unknown>) => void
  accountKey: string
  pubkey: string | null
  signer: ISigner | null
  relays: string[]
  writeRelays: string[]
  uploadServers: string[]
  signal: AbortSignal
  isActive: () => boolean
  prompt: (prompt: HostPrompt | null) => void
  confirm: (description: string, signal: AbortSignal) => Promise<boolean>
  configuration: (config: NappletConfig | null) => void
  media: (media: NappletMedia | null) => void
  files: (files: ExportFile[]) => void
  open: (entry: IntentEntry) => void
  theme: ThemeSource
}

// This is metadata and queued foreground navigation, never a background runtime.
let intentScope: { account: string; workspace: IntentWorkspace } | undefined

export async function createNappletRuntime(options: RuntimeOptions) {
  const assertActive = () => {
    options.signal.throwIfAborted()
    if (!options.isActive()) throw new Error('Napplet session closed')
  }
  assertActive()
  if (!isNapplet(options.event)) throw new Error('Not a napplet manifest')
  const release = await preparePlayback(options.event)
  const hash = release.artifactHash
  assertActive()
  const title = nappletTitle(options.event)
  const discovery = new ProtocolClient(() => options.relays)
  if (!intentScope || intentScope.account !== options.accountKey) {
    intentScope = {
      account: options.accountKey,
      workspace: new IntentWorkspace({
        choose: async (availability) => {
          const candidate = availability.candidates[0]
          return candidate &&
            (await options.confirm(
              options.translate('Open {{name}}?', { name: candidate.title ?? 'Napplet' }),
              options.signal
            ))
            ? candidate.id
            : null
        },
        launch: async (entry) => {
          options.open(entry)
        }
      })
    }
    const scope = intentScope
    const unregister = registerNappletSession(() => {
      scope.workspace.dispose()
      if (intentScope === scope) intentScope = undefined
      unregister()
    })
  }
  const workspace = intentScope.workspace
  // Callbacks must belong to the current foreground session, not an earlier iframe.
  workspace.setHost({
    discover: async (archetype) => {
      assertActive()
      const events = await discovery.queryAvailable(
        [
          {
            kinds: [35129, 15129],
            ...(archetype ? { '#z': [archetype] } : {}),
            limit: 30
          }
        ],
        [],
        options.signal
      )
      assertActive()
      for (const event of events) {
        try {
          await workspace.install(event, nappletTitle(event))
        } catch {
          /* Unsupported entry. */
        }
      }
    },
    choose: async (availability) => {
      for (const candidate of availability.candidates) {
        assertActive()
        if (
          await options.confirm(
            options.translate('Open {{name}}?', { name: candidate.title ?? 'Napplet' }),
            options.signal
          )
        )
          return candidate.id
      }
      return null
    },
    launch: async (entry) => {
      options.open(entry)
    }
  })
  const installed = await workspace.install(options.event, title)
  assertActive()
  const approved = new Set<string>()
  const pending = new Map<string, Promise<boolean>>()
  const allow = (key: string, description: string, signal: AbortSignal) => {
    if (approved.has(key)) return Promise.resolve(true)
    let promise = pending.get(key)
    if (!promise) {
      promise = options
        .confirm(description, signal)
        .then((accepted) => {
          assertActive()
          if (accepted) approved.add(key)
          return accepted
        })
        .finally(() => pending.delete(key))
      pending.set(key, promise)
    }
    return promise
  }
  let declaration: ReturnType<typeof declaredConfig> = {}
  const doc = await loadArtifact(
    hash,
    options.signal,
    (html) => {
      declaration = declaredConfig(html)
      return nappletPrelude(shim, declaration)
    },
    release.servers
  )
  assertActive()
  const host = attachNappletHost({
    frame: options.frame,
    messageTarget: options.messageTarget,
    send: options.send,
    identity: release.hostIdentity,
    manifestId: options.event.id,
    title,
    relays: options.relays,
    actionRelays: options.writeRelays,
    servers: release.servers,
    uploadServers: options.uploadServers,
    pubkey: options.pubkey,
    storage: accountStorage(localStorage, options.accountKey),
    isActive: options.isActive,
    intent: { workspace, catalogId: installed.id },
    authorize: async (message, signal) => {
      assertActive()
      const type = String(message.type)
      if (options.pubkey && (type.startsWith('identity.') || type === 'common.follows')) {
        return allow(
          type,
          options.translate(
            '{{name}} requests account information.\n\nInformation: {{information}}\nAccount: {{pubkey}}',
            {
              name: title,
              information: options.translate(identityDescription(type)),
              pubkey: options.pubkey
            }
          ),
          signal
        )
      }
      if (type === 'resource.bytes' || type === 'resource.bytesMany') {
        const requests = type === 'resource.bytes' ? [message] : message.requests
        if (!Array.isArray(requests) || requests.length > 16)
          throw new Error('Invalid resource request')
        for (const request of requests) {
          if (!request || typeof request.url !== 'string') throw new Error('Invalid resource URL')
          if (request.url.startsWith('data:')) continue
          const origins = request.url.startsWith('blossom:')
            ? [...release.servers, ...(Array.isArray(request.servers) ? request.servers : [])]
            : [request.url]
          for (const url of origins) {
            const origin = new URL(String(url)).origin
            if (
              !(await allow(
                `network:${origin}`,
                options.translate('{{name}} requests resources from {{origin}}.', {
                  name: title,
                  origin
                }),
                signal
              ))
            )
              return false
          }
        }
      }
      return true
    },
    sign:
      options.signer && options.pubkey
        ? async (pubkey, template) => {
            assertActive()
            if (pubkey !== options.pubkey || (await options.signer!.getPublicKey()) !== pubkey)
              throw new Error('Account mismatch')
            assertActive()
            const event = await options.signer!.signEvent(structuredClone(template))
            assertActive()
            return event
          }
        : undefined,
    prompt: options.prompt,
    files: options.files,
    configuration: options.configuration,
    media: options.media,
    theme: options.theme,
    declaration
  })
  options.frame.srcdoc = doc
  return {
    close() {
      host.close()
      discovery.close()
      options.frame.removeAttribute('srcdoc')
      options.frame.src = 'about:blank'
    }
  }
}

function identityDescription(type: string) {
  const descriptions: Record<string, string> = {
    'identity.getPublicKey': 'your public key',
    'identity.getProfile': 'your public profile',
    'identity.getRelays': 'your relay preferences',
    'identity.getFollows': 'your follow list',
    'common.follows': 'your follow list',
    'identity.getMutes': 'your mute list',
    'identity.getBlocked': 'your block list',
    'identity.getList': 'your saved lists',
    'identity.getZaps': 'your zap receipts',
    'identity.getBadges': 'your badges'
  }
  return descriptions[type] ?? 'your account information'
}
