import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_NOSTRCONNECT_RELAY } from '@/constants'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { Check, Copy, Loader, ScanQrCode } from 'lucide-react'
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { createNostrConnectURI, NostrConnectParams } from 'nostr-tools/nip46'
import QrScanner from 'qr-scanner'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QrCode from '../QrCode'

export default function NostrConnectLogin({
  back,
  onLoginSuccess
}: {
  back: () => void
  onLoginSuccess: () => void
}) {
  const { t } = useTranslation()
  const { nostrConnectionLogin, bunkerLogin } = useNostr()
  const [pending, setPending] = useState(false)
  const [bunkerInput, setBunkerInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [nostrConnectionErrMsg, setNostrConnectionErrMsg] = useState<string | null>(null)
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const [qrCodeSize, setQrCodeSize] = useState(100)
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const qrScannerCheckTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBunkerInput(e.target.value)
    if (errMsg) setErrMsg(null)
  }

  const handleLogin = (bunker: string = bunkerInput) => {
    const _bunker = bunker.trim()
    if (_bunker.trim() === '') return

    setPending(true)
    bunkerLogin(_bunker)
      .then(() => onLoginSuccess())
      .catch((err) => setErrMsg(err.message || 'Login failed'))
      .finally(() => setPending(false))
  }

  const [loginDetails] = useState(() => {
    const newPrivKey = generateSecretKey()
    const newMeta: NostrConnectParams = {
      clientPubkey: getPublicKey(newPrivKey),
      relays: DEFAULT_NOSTRCONNECT_RELAY,
      secret: Math.random().toString(36).substring(7),
      name: document.location.host,
      url: document.location.origin
    }
    const newConnectionString = createNostrConnectURI(newMeta)
    return {
      privKey: newPrivKey,
      connectionString: newConnectionString
    }
  })

  useLayoutEffect(() => {
    const calculateQrSize = () => {
      if (qrContainerRef.current) {
        const containerWidth = qrContainerRef.current.offsetWidth
        const desiredSizeBasedOnWidth = Math.min(containerWidth - 8, containerWidth * 0.9)
        const newSize = Math.max(100, Math.min(desiredSizeBasedOnWidth, 360))
        setQrCodeSize(newSize)
      }
    }

    calculateQrSize()

    const resizeObserver = new ResizeObserver(calculateQrSize)
    if (qrContainerRef.current) {
      resizeObserver.observe(qrContainerRef.current)
    }

    return () => {
      if (qrContainerRef.current) {
        resizeObserver.unobserve(qrContainerRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!loginDetails.privKey || !loginDetails.connectionString) return
    setNostrConnectionErrMsg(null)
    nostrConnectionLogin(loginDetails.privKey, loginDetails.connectionString)
      .then(() => onLoginSuccess())
      .catch((err) => {
        console.error('NostrConnectionLogin Error:', err)
        setNostrConnectionErrMsg(
          err.message ? `${err.message}. Please reload.` : 'Connection failed. Please reload.'
        )
      })
  }, [loginDetails, nostrConnectionLogin, onLoginSuccess])

  const copyConnectionString = async () => {
    if (!loginDetails.connectionString) return

    navigator.clipboard.writeText(loginDetails.connectionString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startQrScan = async () => {
    try {
      setIsScanning(true)
      setErrMsg(null)

      // Wait for next render cycle to ensure video element is in DOM
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (!videoRef.current) {
        throw new Error('Video element not found')
      }

      const hasCamera = await QrScanner.hasCamera()
      if (!hasCamera) {
        throw new Error('No camera found')
      }

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          setBunkerInput(result.data)
          stopQrScan()
          handleLogin(result.data)
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment'
        }
      )

      qrScannerRef.current = qrScanner
      await qrScanner.start()

      // Check video feed after a delay
      qrScannerCheckTimerRef.current = setTimeout(() => {
        if (
          videoRef.current &&
          (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0)
        ) {
          setErrMsg('Camera feed not available')
        }
      }, 1000)
    } catch (error) {
      setErrMsg(
        `Failed to start camera: ${error instanceof Error ? error.message : 'Unknown error'}. Please check permissions.`
      )
      setIsScanning(false)
      if (qrScannerCheckTimerRef.current) {
        clearTimeout(qrScannerCheckTimerRef.current)
        qrScannerCheckTimerRef.current = null
      }
    }
  }

  const stopQrScan = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }
    setIsScanning(false)
    if (qrScannerCheckTimerRef.current) {
      clearTimeout(qrScannerCheckTimerRef.current)
      qrScannerCheckTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopQrScan()
    }
  }, [])

  return (
    <div className="relative flex flex-col gap-4">
      <div ref={qrContainerRef} className="mb-3 flex w-full flex-col items-center gap-3">
        <a href={loginDetails.connectionString} aria-label="Open with Nostr signer app">
          <QrCode size={qrCodeSize} value={loginDetails.connectionString} />
        </a>
        {nostrConnectionErrMsg && (
          <div className="pt-1 text-center text-xs text-destructive">{nostrConnectionErrMsg}</div>
        )}
      </div>
      <div className="mb-3 flex w-full justify-center">
        <div
          className="flex cursor-pointer items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-muted/80"
          style={{
            width: qrCodeSize > 0 ? `${Math.max(150, Math.min(qrCodeSize, 320))}px` : 'auto'
          }}
          onClick={copyConnectionString}
          role="button"
          tabIndex={0}
        >
          <div className="min-w-0 grow select-none truncate">
            {loginDetails.connectionString}
          </div>
          <div className="shrink-0">{copied ? <Check size={14} /> : <Copy size={14} />}</div>
        </div>
      </div>

      <div className="my-4 flex w-full items-center">
        <div className="grow border-t border-border/40"></div>
        <span className="px-3 text-xs text-muted-foreground">OR</span>
        <div className="grow border-t border-border/40"></div>
      </div>

      <div className="w-full space-y-1">
        <div className="flex items-start gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="bunker://..."
              value={bunkerInput}
              onChange={handleInputChange}
              className={errMsg ? 'border-destructive pr-10' : 'pr-10'}
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
              onClick={startQrScan}
              disabled={pending}
            >
              <ScanQrCode />
            </Button>
          </div>
          <Button onClick={() => handleLogin()} disabled={pending}>
            <Loader className={pending ? 'mr-2 animate-spin' : 'hidden'} />
            {t('Login')}
          </Button>
        </div>

        {errMsg && <div className="pl-3 pt-1 text-xs text-destructive">{errMsg}</div>}
      </div>
      <Button variant="secondary" onClick={back} className="w-full">
        {t('Back')}
      </Button>

      <div className={cn('flex h-full w-full justify-center', isScanning ? '' : 'hidden')}>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-background"
          autoPlay
          playsInline
          muted
        />
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-2 top-2"
          onClick={stopQrScan}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
