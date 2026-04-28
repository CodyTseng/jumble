import { generateImageByPubkey } from '@/lib/pubkey'
import { useEffect, useMemo, useState } from 'react'
import Image from '../Image'

export default function ProfileBanner({ pubkey, banner }: { pubkey: string; banner?: string }) {
  const defaultBanner = useMemo(() => generateImageByPubkey(pubkey), [pubkey])
  const [bannerUrl, setBannerUrl] = useState(banner ?? defaultBanner)

  useEffect(() => {
    if (banner) {
      setBannerUrl(banner)
    } else {
      setBannerUrl(defaultBanner)
    }
  }, [defaultBanner, banner])

  return (
    <Image
      image={{ url: bannerUrl, pubkey }}
      alt={`${pubkey} banner`}
      className="w-full"
      classNames={{
        wrapper: 'rounded-none aspect-3/1 w-full'
      }}
      errorPlaceholder={defaultBanner}
    />
  )
}
