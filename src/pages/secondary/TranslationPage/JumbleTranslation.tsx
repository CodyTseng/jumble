import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { JUMBLE_API_BASE_URL } from '@/constants'
import { useToast } from '@/hooks'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import transaction from '@/services/transaction.service'
import { closeModal, launchPaymentModal } from '@getalby/bitcoin-connect-react'
import { Check, Copy, Eye, EyeOff, Loader, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

export function JumbleTranslation() {
  const { toast } = useToast()
  const { pubkey, checkLogin } = useNostr()
  const { account, getAccount, regenerateApiKey } = useTranslationService()
  const [refreshCount, setRefreshCount] = useState(0)
  const [loadingAccount, setLoadingAccount] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [recharging, setRecharging] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(1000)
  const [resettingApiKey, setResettingApiKey] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  useEffect(() => {
    if (!pubkey) return

    const init = async () => {
      try {
        setLoadingAccount(true)
        await getAccount()
      } catch (error) {
        toast({
          title: 'Failed to load account',
          description:
            error instanceof Error ? error.message : 'An error occurred while loading the account',
          variant: 'destructive'
        })
      } finally {
        setLoadingAccount(false)
      }
    }
    init()
  }, [pubkey, refreshCount])

  const presetAmounts = [
    { amount: 1_000, text: '1k' },
    { amount: 2_500, text: '2.5k' },
    { amount: 5_000, text: '5k' },
    { amount: 10_000, text: '10k' },
    { amount: 25_000, text: '25k' },
    { amount: 50_000, text: '50k' },
    { amount: 100_000, text: '100k' },
    { amount: 250_000, text: '250k' }
  ]
  const charactersPerUnit = 100 // 1 unit = 100 characters

  const calculateCharacters = (amount: number) => {
    return amount * charactersPerUnit
  }

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount)
    setRechargeAmount(amount.toString())
  }

  const handleInputChange = (value: string) => {
    const numValue = parseInt(value) || 0
    setRechargeAmount(value)
    setSelectedAmount(numValue >= 1000 ? numValue : null)
  }

  const handleRecharge = async (amount: number | null) => {
    if (recharging || !account || !amount || amount < 1000) return

    setRecharging(true)
    try {
      const { transactionId, invoiceId } = await transaction.createTransaction(
        account.pubkey,
        amount
      )

      let checkPaymentInterval: ReturnType<typeof setInterval> | undefined = undefined
      const { setPaid } = launchPaymentModal({
        invoice: invoiceId,
        onCancelled: () => {
          clearInterval(checkPaymentInterval)
          setRecharging(false)
        }
      })

      let failedCount = 0
      checkPaymentInterval = setInterval(async () => {
        try {
          const { state } = await transaction.checkTransaction(transactionId)
          if (state === 'pending') return

          clearInterval(checkPaymentInterval)
          setRecharging(false)

          if (state === 'settled') {
            setPaid({ preimage: '' }) // Preimage is not returned, but we can assume payment is successful
            setRefreshCount((prev) => prev + 1)
          } else {
            closeModal()
            toast({
              title: 'Invoice Expired',
              description: 'The invoice has expired or the payment was not successful.',
              variant: 'destructive'
            })
          }
        } catch (err) {
          failedCount++
          if (failedCount <= 3) return

          clearInterval(checkPaymentInterval)
          setRecharging(false)
          toast({
            title: 'Recharge Failed',
            description: err instanceof Error ? err.message : 'An error occurred while recharging',
            variant: 'destructive'
          })
        }
      }, 2000)
    } catch (err) {
      setRecharging(false)
      toast({
        title: 'Recharge Failed',
        description: err instanceof Error ? err.message : 'An error occurred while recharging',
        variant: 'destructive'
      })
    }
  }

  const handleRegenerateApiKey = async () => {
    if (resettingApiKey || !account) return

    setResettingApiKey(true)
    try {
      await regenerateApiKey()
      setShowResetDialog(false)
    } catch (error) {
      toast({
        title: 'Failed to Reset API Key',
        description:
          error instanceof Error ? error.message : 'An error occurred while resetting the API key',
        variant: 'destructive'
      })
    } finally {
      setResettingApiKey(false)
    }
  }

  if (!account && !loadingAccount) {
    return (
      <div className="w-full flex justify-center">
        <Button onClick={() => checkLogin(() => setRefreshCount((prev) => prev + 1))}>Login</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Balance display in characters */}
      <div className="space-y-2">
        <p className="font-medium">Balance</p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{account?.balance.toLocaleString() ?? '0'}</p>
          <p className="text-muted-foreground">characters</p>
        </div>
      </div>

      {/* API Key section with visibility toggle and copy functionality */}
      <div className="space-y-2">
        <p className="font-medium">API Key</p>
        <div className="flex items-center gap-2">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={account?.api_key ?? ''}
            readOnly
            className="font-mono w-fit"
          />
          <Button variant="outline" onClick={() => setShowApiKey(!showApiKey)}>
            {showApiKey ? <EyeOff /> : <Eye />}
          </Button>
          <Button
            variant="outline"
            disabled={!account?.api_key}
            onClick={() => {
              if (!account?.api_key) return
              navigator.clipboard.writeText(account.api_key)
              setCopied(true)
              setTimeout(() => setCopied(false), 4000)
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!account?.api_key}>
                <RotateCcw />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset API Key</DialogTitle>
                <DialogDescription>
                  Are you sure you want to reset your API key? This action cannot be undone.
                  <br />
                  <br />
                  <strong>Warning:</strong> Your current API key will become invalid immediately,
                  and any applications using it will stop working until you update them with the new
                  key.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowResetDialog(false)}
                  disabled={resettingApiKey}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRegenerateApiKey}
                  disabled={resettingApiKey}
                >
                  {resettingApiKey && <Loader className="animate-spin" />}
                  Reset API Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground select-text">
          This API is compatible with LibreTranslate. Service URL: {JUMBLE_API_BASE_URL}
        </p>
      </div>

      {/* Recharge section */}
      <div className="space-y-4">
        <p className="font-medium">Recharge</p>

        {/* Preset amounts */}
        <div className="grid grid-cols-2 gap-2">
          {presetAmounts.map(({ amount, text }) => (
            <Button
              key={amount}
              variant="outline"
              onClick={() => handlePresetClick(amount)}
              className={cn(
                'flex flex-col h-auto py-3 hover:bg-primary/10',
                selectedAmount === amount && 'border border-primary bg-primary/10'
              )}
            >
              <span className="text-lg font-semibold">{text} sats</span>
              <span className="text-sm text-muted-foreground">
                {calculateCharacters(amount).toLocaleString()} characters
              </span>
            </Button>
          ))}
        </div>

        {/* Custom amount input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Custom amount"
              value={rechargeAmount}
              onChange={(e) => handleInputChange(e.target.value)}
              min={1000}
              className="w-40"
            />
            <span className="text-sm text-muted-foreground">sats</span>
          </div>
          {selectedAmount && selectedAmount >= 1000 && (
            <p className="text-sm text-muted-foreground">
              Will receive: {calculateCharacters(selectedAmount).toLocaleString()} characters
            </p>
          )}
        </div>

        <Button
          className="w-full"
          disabled={recharging || !selectedAmount || selectedAmount < 1000}
          onClick={() => handleRecharge(selectedAmount)}
        >
          {recharging && <Loader className="animate-spin" />}
          {selectedAmount && selectedAmount >= 1000
            ? 'Recharge ' + selectedAmount.toLocaleString() + ' sats'
            : `Minimum recharge is 1,000 sats`}
        </Button>
      </div>
    </div>
  )
}
