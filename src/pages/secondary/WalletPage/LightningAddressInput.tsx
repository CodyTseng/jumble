import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks'
import { isEmail } from '@/lib/common'
import { createProfileDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function LightningAddressInput() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { profile, profileEvent, publish, updateProfileEvent } = useNostr()
  const [lightningAddress, setLightningAddress] = useState('')
  const [hasChanged, setHasChanged] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setLightningAddress(profile.lightningAddress || '')
    }
  }, [profile])

  if (!profile || !profileEvent) {
    return null
  }

  const handleSave = async () => {
    setSaving(true)
    let lud06 = profile.lud06
    let lud16 = profile.lud16
    if (lightningAddress.startsWith('lnurl')) {
      lud06 = lightningAddress
    } else if (isEmail(lightningAddress)) {
      lud16 = lightningAddress
    } else {
      toast({
        title: 'Invalid Lightning Address',
        description: 'Please enter a valid Lightning Address or LNURL',
        variant: 'destructive'
      })
      setSaving(false)
      return
    }

    const oldProfileContent = profileEvent ? JSON.parse(profileEvent.content) : {}
    const newProfileContent = {
      ...oldProfileContent,
      lud06,
      lud16
    }
    const profileDraftEvent = createProfileDraftEvent(
      JSON.stringify(newProfileContent),
      profileEvent?.tags
    )
    const newProfileEvent = await publish(profileDraftEvent)
    await updateProfileEvent(newProfileEvent)
    setSaving(false)
  }

  return (
    <div className="w-full space-y-1">
      <Label htmlFor="ln-address">{t('Lightning Address (or LNURL)')}</Label>
      <div className="flex w-full items-center gap-2">
        <Input
          id="ln-address"
          placeholder="xxxxxxxx@xxx.xxx"
          value={lightningAddress}
          onChange={(e) => {
            setLightningAddress(e.target.value)
            setHasChanged(true)
          }}
        />
        <Button onClick={handleSave} disabled={saving || !hasChanged} className="w-20">
          {saving ? <Loader className="animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}
