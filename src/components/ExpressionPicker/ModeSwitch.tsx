import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export type TExpressionPickerMode = 'emoji' | 'gif'

export default function ModeSwitch({
  mode,
  onChange
}: {
  mode: TExpressionPickerMode
  onChange: (mode: TExpressionPickerMode) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1 border-t bg-background px-1.5 py-1">
      <SwitchButton
        isActive={mode === 'emoji'}
        onClick={() => onChange('emoji')}
        label={t('Emoji')}
      />
      <SwitchButton
        isActive={mode === 'gif'}
        onClick={() => onChange('gif')}
        label={t('GIF')}
      />
    </div>
  )
}

function SwitchButton({
  isActive,
  onClick,
  label
}: {
  isActive: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 cursor-pointer rounded-md py-1.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}
