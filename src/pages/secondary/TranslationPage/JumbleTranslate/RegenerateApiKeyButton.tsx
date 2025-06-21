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
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { Loader, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function RegenerateApiKeyButton() {
  const { account, regenerateApiKey } = useTranslationService()
  const [resettingApiKey, setResettingApiKey] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  const handleRegenerateApiKey = async () => {
    if (resettingApiKey || !account) return

    setResettingApiKey(true)
    try {
      await regenerateApiKey()
      setShowResetDialog(false)
    } catch (error) {
      toast.error(
        'Failed to Reset API Key: ' +
          (error instanceof Error ? error.message : 'An error occurred while resetting the API key')
      )
    } finally {
      setResettingApiKey(false)
    }
  }

  return (
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
            <strong>Warning:</strong> Your current API key will become invalid immediately, and any
            applications using it will stop working until you update them with the new key.
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
          <Button variant="destructive" onClick={handleRegenerateApiKey} disabled={resettingApiKey}>
            {resettingApiKey && <Loader className="animate-spin" />}
            Reset API Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
