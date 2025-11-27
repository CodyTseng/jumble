import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useSecondaryPage } from '@/PageManager'
import { useGuestConversion } from '@/providers/GuestConversionProvider'
import { useNostr } from '@/providers/NostrProvider'
import guestEngagementService from '@/services/guest-engagement.service'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function GuestModeIndicator() {
  const { t } = useTranslation()
  const { account } = useNostr()
  const { isGuest } = useGuestConversion()
  const { push } = useSecondaryPage()
  const [engagement, setEngagement] = useState(guestEngagementService.getEngagement())

  useEffect(() => {
    // Subscribe to engagement changes
    const unsubscribe = guestEngagementService.subscribe((newEngagement) => {
      setEngagement(newEngagement)
    })

    return unsubscribe
  }, [])

  // Only show for guest accounts (users without a published profile)
  if (!isGuest || !account) {
    return null
  }

  const progress = (engagement.count / guestEngagementService.getThreshold()) * 100
  const remaining = Math.max(0, guestEngagementService.getThreshold() - engagement.count)

  const handleCreateAccountNow = () => {
    push('/profile-editor')
  }

  return (
    <div className="border border-primary/20 rounded-lg p-3 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-semibold">{t('Lurker Mode')}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {engagement.count}/{guestEngagementService.getThreshold()}
        </span>
      </div>

      <Progress value={progress} className="h-2 mb-2" />

      <p className="text-xs text-muted-foreground mb-3">
        {remaining > 0
          ? t("We'll remind you to save your account in {{count}} more interactions", {
              count: remaining
            })
          : t('Ready to make this your permanent account!')}
      </p>

      <Button onClick={handleCreateAccountNow} size="sm" className="w-full" variant="outline">
        {t('Create Account Now!')}
      </Button>
    </div>
  )
}
