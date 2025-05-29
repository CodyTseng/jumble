import { Button } from '@/components/ui/button'
import { DEFAULT_NOSTRCONNECT_RELAY } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { createNostrConnectURI, NostrConnectParams } from '@/providers/NostrProvider/nip46'
import { Loader } from 'lucide-react'
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function QRCodeLogin({
  back,
  onLoginSuccess
}: {
  back: () => void
  onLoginSuccess: () => void
}) {
  const { t } = useTranslation()
  const { qrcodeLogin } = useNostr()
  const [pending, setPending] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

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

  useEffect(() => {
    setPending(true)
    qrcodeLogin(loginDetails.privKey, loginDetails.connectionString)
      .then(() => onLoginSuccess())
      .catch((err) => {
        console.error("QRCodeLogin Error:", err);
        setErrMsg(err.message)
      })
      .finally(() => setPending(false))
  }, [loginDetails, qrcodeLogin, onLoginSuccess])

  return (
    <>
      <div className="flex flex-col items-center space-y-1">
        <QRCodeSVG size={100} value={loginDetails.connectionString} />
        {errMsg && <div className="text-xs text-destructive pl-3">{errMsg}</div>}
      </div>
      <Button variant="secondary" disabled={pending}>
        <Loader className={pending ? 'animate-spin' : 'hidden'} />
        {pending ? t('loading...') : t('Scan QR Code')}
      </Button>
      <Button variant="secondary" onClick={back}>
        {t('Back')}
      </Button>
    </>
  )
}