import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'

/**
 * Central-server URL field for the pomegranate flows. Renders bare (no
 * disclosure wrapper) so it can sit inside a shared `AdvancedOptions`, next to
 * the operator/threshold config in the bind dialog or on its own in login.
 */
export default function PomegranateCentralServerField({
  central,
  onCentralChange,
  disabled
}: {
  central: string
  onCentralChange: (next: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {t('Central server')}
      </div>
      <p className="text-muted-foreground text-xs">
        {t(
          'The coordinator that verifies your Google sign-in and relays signing requests to the operators.'
        )}
      </p>
      <Input
        className="h-9"
        value={central}
        disabled={disabled}
        placeholder="https://..."
        onChange={(e) => onCentralChange(e.target.value)}
      />
    </div>
  )
}
