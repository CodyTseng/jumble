import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Copy, Check } from 'lucide-react'
import { createNostrConnectURI, NostrConnectParams } from '@/providers/NostrProvider/nip46'
import { DEFAULT_NOSTRCONNECT_RELAY } from '@/constants'
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBunkerInput(e.target.value)
    if (errMsg) setErrMsg(null)
  }

  const handleLogin = () => {
    if (bunkerInput === '') return

    setPending(true)
    bunkerLogin(bunkerInput)
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
      url: document.location.origin,
    }
    const newConnectionString = createNostrConnectURI(newMeta)
    return {
      privKey: newPrivKey,
      connectionString: newConnectionString,
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
    if (!loginDetails.privKey || !loginDetails.connectionString) return;
    setNostrConnectionErrMsg(null)
    nostrConnectionLogin(loginDetails.privKey, loginDetails.connectionString)
      .then(() => onLoginSuccess())
      .catch((err) => {
        console.error("NostrConnectionLogin Error:", err)
        setNostrConnectionErrMsg(err.message ? `${err.message}. Please reload.` : 'Connection failed. Please reload.')
      })
  }, [loginDetails, nostrConnectionLogin, onLoginSuccess])


  const copyConnectionString = async () => {
    if (!loginDetails.connectionString) return

    navigator.clipboard.writeText(loginDetails.connectionString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div ref={qrContainerRef} className="flex flex-col items-center w-full space-y-3 mb-3">
        <a href={loginDetails.connectionString} aria-label="Open with Nostr signer app">
          <QRCodeSVG size={qrCodeSize} value={loginDetails.connectionString} marginSize={1} />
        </a>
        {nostrConnectionErrMsg && (
          <div className="text-xs text-destructive text-center pt-1">
            {nostrConnectionErrMsg}
          </div>
        )}
      </div>
      <div className="flex justify-center w-full mb-3">
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-full cursor-pointer transition-all hover:bg-muted/80"
          style={{
            width: qrCodeSize > 0 ? `${Math.max(150, Math.min(qrCodeSize, 320))}px` : 'auto',
          }}
          onClick={copyConnectionString}
          role="button"
          tabIndex={0}
        >
          <div className="flex-grow min-w-0 truncate select-none">
            {loginDetails.connectionString}
          </div>
          <div className="flex-shrink-0">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </div>
        </div>
      </div>

      <div className="flex items-center w-full my-4">
        <div className="flex-grow border-t border-border/40"></div>
        <span className="px-3 text-xs text-muted-foreground">OR</span>
        <div className="flex-grow border-t border-border/40"></div>
      </div>

      <div className="w-full space-y-1">
        <div className="flex items-start space-x-2">
          <Input
            placeholder="bunker://..."
            value={bunkerInput}
            onChange={handleInputChange}
            className={errMsg ? 'border-destructive' : ''}
          />
          <Button onClick={handleLogin} disabled={pending}>
            <Loader className={pending ? 'animate-spin mr-2' : 'hidden'} />
            {t('Login')}
          </Button>
        </div>
        {errMsg && <div className="text-xs text-destructive pl-3 pt-1">{errMsg}</div>}
      </div>
      <Button variant="secondary" onClick={back} className="w-full">
        {t('Back')}
      </Button>
    </>
  )
}