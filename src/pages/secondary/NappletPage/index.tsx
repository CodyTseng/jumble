import SigningApproval, { SigningDecisions, signingAction } from './SigningApproval'
import NappletIcon from '@/components/NappletCard/Icon'
import ConfigControls, { ConfigButton } from './Settings'
import { RECOMMENDED_BLOSSOM_SERVERS } from '@/constants'
import NappletBookmarkButton from './BookmarkButton'
import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getDefaultRelayUrls } from '@/lib/relay'
import { getNoteBech32Id } from '@/lib/event'
import { toNapplet } from '@/lib/link'
import { nappletAccountKey, registerNappletSession } from '@/lib/napplet/session'
import { nappletTitle } from '@/lib/napplet'
import { getNappletCarrier, nappletCarrierUrl } from '@/lib/napplet/carrier'
import type { RuntimeOptions } from '@/lib/napplet/runtime'
import type { HostPrompt } from '@/lib/napplet/vendor/runtime/src/host'
import type { ExportFile } from '@/lib/napplet/vendor/runtime/src/filesystem'
import type { NappletConfig } from '@/lib/napplet/vendor/runtime/src/config-session'
import type { NappletMedia } from '@/lib/napplet/vendor/runtime/src/media-session'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import storage from '@/services/local-storage.service'
import client from '@/services/client.service'
import type { TPageRef } from '@/types'
import {
  forwardRef,
  type ForwardedRef,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Maximize, RotateCw } from 'lucide-react'

type Consent = {
  value: string
  accept: () => void
  deny: () => void
  picker?: HostPrompt
  host?: boolean
  expiresAt: number
}

const NappletPage = forwardRef<TPageRef, { id?: string; index?: number }>(({ id, index }, ref) => {
  const { currentIndex } = useSecondaryPage()
  const { account } = useNostr()
  const { event, isFetching } = useFetchEvent(id)
  const { t } = useTranslation()
  const key = nappletAccountKey(account)
  if (currentIndex === index && !isFetching && event) {
    return <NappletRunner key={`${key}:${event.id}`} event={event} index={index} layoutRef={ref} />
  }
  return (
    <SecondaryPageLayout ref={ref} index={index} title="Napplet" noScrollArea>
      {currentIndex === index && (
        <div
          role={isFetching ? 'status' : undefined}
          className="flex flex-1 items-center justify-center p-4 text-center"
        >
          {t(isFetching ? 'Loading...' : 'Note not found')}
        </div>
      )}
    </SecondaryPageLayout>
  )
})
NappletPage.displayName = 'NappletPage'
export default NappletPage

function NappletRunner({
  event,
  index,
  layoutRef
}: {
  event: NonNullable<ReturnType<typeof useFetchEvent>['event']>
  index?: number
  layoutRef: ForwardedRef<TPageRef>
}) {
  const nostr = useNostr()
  const { push, pop } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const { t } = useTranslation()
  const frame = useRef<HTMLIFrameElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(0)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'loading' | 'running' | 'stopped'>('loading')
  const [consent, setConsent] = useState<Consent | null>(null)
  const currentConsent = useRef<Consent | null>(null)
  const [files, setFiles] = useState<ExportFile[]>([])
  const [config, setConfig] = useState<NappletConfig | null>(null)
  const [media, setMedia] = useState<NappletMedia | null>(null)
  const downloadUrls = useRef<string[]>([])
  const accountKey = nappletAccountKey(nostr.account)

  useLayoutEffect(() => {
    // Dialog portals live under body, outside the fullscreen runner element.
    if (consent && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [consent])

  useLayoutEffect(() => {
    const controller = new AbortController()
    // StrictMode replays setup after cleanup has navigated the old carrier to about:blank.
    if (frame.current) {
      const url = new URL(nappletCarrierUrl())
      url.searchParams.set('instance', crypto.randomUUID())
      frame.current.src = url.href
    }
    let runtime:
      | Awaited<ReturnType<(typeof import('@/lib/napplet/runtime'))['createNappletRuntime']>>
      | undefined
    let closed = false
    const isActive = () =>
      !closed &&
      !controller.signal.aborted &&
      nappletAccountKey(storage.getCurrentAccount()) === accountKey
    const close = () => {
      if (closed) return
      closed = true
      controller.abort()
      currentConsent.current?.deny()
      currentConsent.current = null
      runtime?.close()
      runtime = undefined
      if (frame.current) {
        frame.current.removeAttribute('srcdoc')
        frame.current.src = 'about:blank'
      }
      setStatus('stopped')
      setConsent(null)
      setConfig(null)
      setMedia(null)
      setFiles([])
      downloadUrls.current.forEach(URL.revokeObjectURL)
      downloadUrls.current = []
    }
    const unregister = registerNappletSession(close)
    const confirm: RuntimeOptions['confirm'] = (value, signal) =>
      new Promise((resolve) => {
        if (!isActive() || signal.aborted || currentConsent.current) {
          resolve(false)
          return
        }
        const finish = (accepted: boolean) => {
          clearTimeout(timer)
          signal.removeEventListener('abort', cancel)
          if (currentConsent.current === request) {
            currentConsent.current = null
            setConsent(null)
          }
          resolve(accepted && isActive() && !signal.aborted && Date.now() < request.expiresAt)
        }
        const cancel = () => finish(false)
        const request = {
          value,
          accept: () => finish(true),
          deny: cancel,
          expiresAt: Date.now() + 60000
        }
        const timer = setTimeout(cancel, 60000)
        currentConsent.current = request
        setConsent(request)
        signal.addEventListener('abort', cancel, { once: true })
      })
    const prompt: RuntimeOptions['prompt'] = (request) => {
      if (!request) {
        if (currentConsent.current?.host) {
          currentConsent.current = null
          setConsent(null)
        }
        return
      }
      if (!isActive() || currentConsent.current) {
        request.dismiss()
        return
      }
      const value = {
        value: request.value,
        host: true,
        expiresAt: request.expiresAt,
        picker: request,
        accept: () => {
          if (!isActive()) {
            request.dismiss()
            return
          }
          if (request.kind === 'link') window.open(request.value, '_blank', 'noopener,noreferrer')
          request.answer(true)
        },
        deny: request.dismiss
      }
      currentConsent.current = value
      setConsent(value)
    }
    setError('')
    setStatus('loading')
    const getTheme = () => {
      const css = getComputedStyle(document.documentElement)
      const color = (name: string) => {
        const value = css.getPropertyValue(name).trim()
        return CSS.supports('color', value) ? value : `hsl(${value})`
      }
      return {
        title: 'Jumble',
        colors: {
          background: color('--background'),
          text: color('--foreground'),
          primary: color('--primary')
        }
      }
    }
    void (async () => {
      const { createNappletRuntime } = await import('@/lib/napplet/runtime')
      if (!isActive() || !frame.current) return
      const carrier = await getNappletCarrier(frame.current, controller.signal)
      if (!isActive()) return
      const pubkey = nostr.account?.pubkey ?? null
      let uploadServers: string[] = []
      if (pubkey) {
        const config = storage.getMediaUploadServiceConfig(pubkey)
        if (config.type === 'blossom') uploadServers = await client.fetchBlossomServerList(pubkey)
        if (config.type === 'blossom' && !uploadServers.length)
          uploadServers = RECOMMENDED_BLOSSOM_SERVERS
      }
      // Context metadata may still belong to the previous account while its effect refreshes.
      const relayList = pubkey ? await client.fetchRelayList(pubkey) : null
      if (!isActive()) return
      const relays = [...new Set([...(relayList?.read ?? []), ...getDefaultRelayUrls()])].slice(
        0,
        8
      )
      runtime = await createNappletRuntime({
        event,
        translate: t,
        frame: carrier.frame,
        messageTarget: carrier.messageTarget,
        send: carrier.send,
        accountKey,
        pubkey,
        signer: nostr.signer,
        relays,
        writeRelays: relayList?.write.length ? relayList.write : relays,
        uploadServers,
        signal: controller.signal,
        isActive,
        confirm,
        prompt,
        configuration: setConfig,
        media: setMedia,
        files: setFiles,
        open: (entry) => {
          if (entry.manifest && isActive()) push(toNapplet(getNoteBech32Id(entry.manifest)))
        },
        theme: {
          get: getTheme,
          subscribe: (listener) => {
            const observer = new MutationObserver(listener)
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class', 'style']
            })
            return () => observer.disconnect()
          }
        }
      })
      if (!isActive()) runtime.close()
      else setStatus('running')
    })().catch((error: unknown) => {
      if (isActive()) {
        setError(error instanceof Error ? error.message : String(error))
        close()
      }
    })
    return () => {
      close()
      unregister()
    }
  }, [run])

  const controls = (
    <div className="flex shrink-0 items-center">
      <NappletBookmarkButton event={event} />
      {config && <ConfigButton config={config} />}
      <Button
        size="titlebar-icon"
        variant="ghost"
        title={t('Fullscreen')}
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
          else void container.current?.requestFullscreen().catch(() => {})
        }}
      >
        <Maximize />
      </Button>
      <Button
        size="titlebar-icon"
        variant="ghost"
        title={t('Reload')}
        onClick={() => setRun((value) => value + 1)}
      >
        <RotateCw />
      </Button>
    </div>
  )

  return (
    <div ref={container} className="bg-background flex h-full min-h-0 flex-1 flex-col">
      <SecondaryPageLayout
        ref={layoutRef}
        index={index}
        title={<span dir="auto">{nappletTitle(event)}</span>}
        controls={controls}
        titlebar={
          isSmallScreen ? (
            <div className="flex h-full min-w-0 items-center justify-between">
              <Button
                variant="ghost"
                size="titlebar-icon"
                title={t('back')}
                onClick={() => pop()}
                className="min-w-0 flex-1 justify-start gap-1 px-2"
              >
                <ChevronLeft className="rtl:-scale-x-100" />
                <span dir="auto" className="truncate text-lg font-semibold">
                  {nappletTitle(event)}
                </span>
              </Button>
              {controls}
            </div>
          ) : undefined
        }
        noScrollArea
      >
        {error && (
          <p role="alert" className="text-destructive p-4 whitespace-pre-wrap">
            {error}
          </p>
        )}
        {status === 'stopped' && (
          <Button className="m-4 self-start" onClick={() => setRun((value) => value + 1)}>
            {t('Open napplet')}
          </Button>
        )}
        <div
          className={status === 'stopped' ? 'hidden' : 'relative min-h-0 flex-1'}
          aria-busy={status === 'loading'}
        >
          {status === 'loading' && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center p-4 text-center"
            >
              {t('Loading...')}
            </div>
          )}
          <iframe
            key={run}
            ref={frame}
            src={nappletCarrierUrl()}
            title={nappletTitle(event)}
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className={`h-full w-full border-0${status === 'loading' ? 'invisible' : ''}`}
            allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
          />
        </div>
        {media && <MediaControls media={media} />}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t p-2">
            {files.map((file) => (
              <Button
                key={file.name}
                variant="outline"
                onClick={() => {
                  const url = URL.createObjectURL(file.blob)
                  downloadUrls.current.push(url)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = file.name
                  link.click()
                }}
              >
                {file.name}
              </Button>
            ))}
          </div>
        )}
        <Dialog
          open={!!consent}
          onOpenChange={(open) => {
            if (!open) currentConsent.current?.deny()
          }}
        >
          <DialogContent
            className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0"
            onOpenAutoFocus={(e) => {
              // Keep approval an explicit click; Enter must not approve on dialog arrival.
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).focus()
            }}
          >
            <DialogHeader className="shrink-0 border-b p-5 pe-14">
              <DialogTitle>
                {t(
                  consent?.picker?.signing
                    ? signingAction(consent.picker.signing)
                    : 'Napplet permission'
                )}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex min-w-0 items-center gap-2 pt-2">
                  <NappletIcon event={event} className="size-8 shrink-0" />
                  <span dir="auto" className="truncate font-medium">
                    {nappletTitle(event)}
                  </span>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-5">
              {consent?.picker?.signing ? (
                <SigningApproval key={consent.expiresAt} request={consent.picker.signing} />
              ) : consent?.picker?.picker ? (
                <div className="space-y-3 text-sm">
                  <p>
                    {t(
                      '{{name}} requests a copy of the selected files. Only selected files will be shared; originals remain unchanged.',
                      { name: nappletTitle(event) }
                    )}
                  </p>
                  {consent.picker.picker.description && (
                    <p dir="auto" className="break-words whitespace-pre-wrap">
                      {consent.picker.picker.description}
                    </p>
                  )}
                </div>
              ) : (
                <pre dir="auto" className="text-sm break-words whitespace-pre-wrap">
                  {consent?.value}
                </pre>
              )}
            </div>
            <div className="shrink-0 space-y-3 border-t p-5">
              {consent?.picker?.picker ? (
                <>
                  <input
                    type="file"
                    aria-label={t('Choose files')}
                    accept={consent.picker.picker.accept}
                    multiple={consent.picker.picker.multiple}
                    ref={(node) => {
                      if (node && consent.picker?.picker?.directory)
                        node.setAttribute('webkitdirectory', '')
                    }}
                    onChange={(e) =>
                      consent.picker?.selectFiles?.(Array.from(e.target.files ?? []))
                    }
                  />
                  <Button variant="outline" onClick={consent.deny}>
                    {t('Cancel')}
                  </Button>
                </>
              ) : consent?.picker?.signing ? (
                <SigningDecisions
                  key={consent.expiresAt}
                  expiresAt={consent.expiresAt}
                  accept={consent.accept}
                  deny={consent.deny}
                />
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={consent?.deny}>
                    {t('Cancel')}
                  </Button>
                  <Button className="flex-1" onClick={consent?.accept}>
                    {t('Allow')}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {config && <ConfigControls config={config} />}
      </SecondaryPageLayout>
    </div>
  )
}

function MediaControls({ media }: { media: NappletMedia }) {
  const sessions = useSyncExternalStore(media.subscribe, media.getSnapshot)
  const { t } = useTranslation()
  return (
    <div>
      {sessions.map((session) => (
        <div key={session.id} className="flex flex-wrap items-center gap-2 border-t p-2">
          <span dir="auto" className="min-w-0 flex-1 truncate">
            {session.title}
          </span>
          {session.error && <span role="status">{session.error}</span>}
          <Button
            variant="outline"
            onClick={() =>
              media.command(session.id, session.status === 'playing' ? 'pause' : 'play')
            }
          >
            {t(session.status === 'playing' ? 'Pause' : 'Play')}
          </Button>
          <Button variant="outline" onClick={() => media.command(session.id, 'stop')}>
            {t('Stop')}
          </Button>
          <input
            type="range"
            aria-label={t('Volume')}
            min="0"
            max="1"
            step="0.05"
            value={session.volume}
            onChange={(e) => media.command(session.id, 'volume', Number(e.target.value))}
          />
        </div>
      ))}
    </div>
  )
}
