import { openExternalUrl } from '@/lib/native-system'
import { useTranslation } from 'react-i18next'
import Image from '../Image'
import OpenSatsLogo from './open-sats-logo.svg'

export default function PlatinumSponsors() {
  const { t } = useTranslation()

  return (
    <section className="space-y-3">
      <div className="text-muted-foreground text-center text-xs font-semibold tracking-wider uppercase">
        {t('Platinum Sponsors')}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex cursor-pointer items-center gap-4 transition-opacity hover:opacity-80"
          onClick={() => openExternalUrl('https://opensats.org/')}
        >
          <Image
            image={{
              url: OpenSatsLogo
            }}
            className="h-11"
          />
          <div className="text-2xl font-semibold">OpenSats</div>
        </div>
      </div>
    </section>
  )
}
