import { cn } from '@/lib/utils'
import { TSignerType } from '@/types'
import { useTranslation } from 'react-i18next'

// Visually unified: all badges share the same muted chip style. We keep a
// tiny color dot so the signer type is still distinguishable at a glance
// without flooding the UI with five competing colors.
const SIGNER_META: Record<TSignerType, { labelKey?: string; literal?: string; dot: string }> = {
  'nip-07': { labelKey: 'Extension', dot: 'bg-emerald-500' },
  bunker: { labelKey: 'Remote', dot: 'bg-sky-500' },
  ncryptsec: { labelKey: 'Encrypted Key', dot: 'bg-violet-500' },
  nsec: { labelKey: 'Private Key', dot: 'bg-amber-500' },
  'browser-nsec': { labelKey: 'Private Key', dot: 'bg-amber-500' },
  npub: { literal: 'NPUB', dot: 'bg-yellow-500' }
}

export default function SignerTypeBadge({
  signerType,
  isPomegranate,
  className
}: {
  signerType: TSignerType
  // Pomegranate ("Login with Google") accounts are bunker accounts, but we give
  // them their own dot + label so they read differently from a plain remote signer.
  isPomegranate?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const meta = SIGNER_META[signerType]
  if (!meta) return null

  const isGoogle = isPomegranate && signerType === 'bunker'
  const label = isGoogle ? 'Google' : (meta.literal ?? (meta.labelKey ? t(meta.labelKey) : ''))
  const dot = isGoogle ? 'bg-pink-500' : meta.dot

  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}
