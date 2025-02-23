import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useZap } from '@/providers/ZapProvider'
import { useTranslation } from 'react-i18next'

export default function QuickZapSwitch() {
  const { t } = useTranslation()
  const { quickZap, updateQuickZap } = useZap()

  return (
    <div className="w-full flex justify-between items-center">
      <Label htmlFor="quick-zap-switch">
        <div className="text-base font-medium">{t('Quick zap')}</div>
        <div className="text-muted-foreground text-sm">
          {t('If enabled, you can zap with a single click')}
        </div>
      </Label>
      <Switch id="quick-zap-switch" checked={quickZap} onCheckedChange={updateQuickZap} />
    </div>
  )
}
