import { Badge } from '@/components/ui/badge'
import { TSignerType } from '@/types'
import { useTranslation } from 'react-i18next'

export default function SignerTypeBadge({ signerType }: { signerType: TSignerType }) {
  const { t } = useTranslation()

  if (signerType === 'nip-07') {
    return <Badge className=" bg-green-400 hover:bg-green-400 px-1 py-0">{t('Extension')}</Badge>
  } else if (signerType === 'bunker') {
    return <Badge className=" bg-blue-400 hover:bg-blue-400 px-1 py-0">{t('Remote')}</Badge>
  } else if (signerType === 'ncryptsec') {
    return (
      <Badge className="bg-violet-400 hover:bg-violet-400 px-1 py-0">{t('Encrypted Key')}</Badge>
    )
  } else if (signerType === 'nsec') {
    return (
      <Badge className=" bg-orange-400 hover:bg-orange-400 px-1 py-0">{t('Private Key')}</Badge>
    )
  } else if (signerType === 'npub') {
    return <Badge className=" bg-yellow-400 hover:bg-yellow-400 px-1 py-0">NPUB</Badge>
  }
}
