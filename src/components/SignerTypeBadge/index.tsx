import { cn } from '@/lib/utils'
import { TSignerType } from '@/types'
import { useTranslation } from 'react-i18next'

// Visually unified: all badges share the same muted chip style. We keep a
// tiny color dot so the signer type is still distinguishable at a glance
// without flooding the UI with five competing colors.
const SIGNER_META: Record<
  TSignerType,
  { labelKey?: string; literal?: string; dot: string }
> = {
  'nip-07': { labelKey: 'Extension', dot: 'bg-emerald-500' },
  bunker: { labelKey: 'Remote', dot: 'bg-sky-500' },
  ncryptsec: { labelKey: 'Encrypted Key', dot: 'bg-violet-500' },
  nsec: { labelKey: 'Private Key', dot: 'bg-amber-500' },
  npub: { literal: 'NPUB', dot: 'bg-yellow-500' }
}

export default function SignerTypeBadge({
  signerType,
  className
}: {
  signerType: TSignerType
  className?: string
}) {
  const { t } = useTranslation()
  const meta = SIGNER_META[signerType]
  if (!meta) return null
  const label = meta.literal ?? (meta.labelKey ? t(meta.labelKey) : '')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {label}
    </span>
  )
}
