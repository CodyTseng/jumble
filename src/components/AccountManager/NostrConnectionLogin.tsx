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
    <div className="relative flex flex-col gap-5">
      {/* Header */}
      <h3 className="text-center text-lg font-semibold">{t('Connect a remote signer')}</h3>

      {/* QR + connection string */}
      <div ref={qrContainerRef} className="flex w-full flex-col items-center gap-3">
        <div className="text-xs text-muted-foreground">{t('Scan with your signer app')}</div>
        <a
          href={loginDetails.connectionString}
          aria-label={t('Open with Nostr signer app')}
          className="rounded-2xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <QrCode size={qrCodeSize} value={loginDetails.connectionString} />
        </a>
        <button
          type="button"
          onClick={copyConnectionString}
          className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/80"
          style={{
            maxWidth: qrCodeSize > 0 ? `${Math.max(150, Math.min(qrCodeSize, 320))}px` : '100%'
          }}
        >
          <span className="min-w-0 flex-1 truncate text-start">
            {loginDetails.connectionString}
          </span>
          {copied ? (
            <Check className="size-3.5 shrink-0" />
          ) : (
            <Copy className="size-3.5 shrink-0" />
          )}
        </button>
        {nostrConnectionErrMsg && (
          <div className="text-center text-xs text-destructive">{nostrConnectionErrMsg}</div>
        )}
      </div>

      {/* OR divider — matches AccountManager style */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground/70">{t('or')}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Bunker URI input — placeholder self-explains, no Label needed */}
      <div className="space-y-1">
        <div className="relative">
          <Input
            id="bunker-input"
            placeholder="bunker://..."
            value={bunkerInput}
            onChange={handleInputChange}
            className={cn('pe-10', errMsg && 'border-destructive')}
          />
          <Button
            size="sm"
            variant="ghost"
            className="absolute! inset-e-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
            onClick={startQrScan}
            disabled={pending}
            aria-label={t('Scan QR code')}
          >
            <ScanQrCode />
          </Button>
        </div>
        {errMsg && <div className="text-xs text-destructive">{errMsg}</div>}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button className="w-fit px-8" variant="secondary" type="button" onClick={back}>
          {t('Back')}
        </Button>
        <Button className="flex-1" onClick={() => handleLogin()} disabled={pending}>
          <Loader className={pending ? 'me-2 animate-spin' : 'hidden'} />
          {t('Login')}
        </Button>
      </div>

      {/* QR scanner overlay */}
      <div className={cn('flex h-full w-full justify-center', isScanning ? '' : 'hidden')}>
        <video
          ref={videoRef}
          className="bg-background absolute inset-0 h-full w-full"
          autoPlay
          playsInline
          muted
        />
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2"
          onClick={stopQrScan}
        >
          {t('Cancel')}
        </Button>
      </div>
    </div>
  )
}
