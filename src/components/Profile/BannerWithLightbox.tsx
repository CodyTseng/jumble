import { generateImageByPubkey } from '@/lib/pubkey'
import { useEffect, useMemo, useState } from 'react'
import ImageWithLightbox from '../ImageWithLightbox'

export default function BannerWithLightbox({
  pubkey,
  banner
}: {
  pubkey: string
  banner?: string
}) {
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
    <ImageWithLightbox
      image={{ url: bannerUrl, pubkey }}
      className="rounded-none w-full aspect-[3/1]"
      classNames={{
        wrapper: 'rounded-none border-none'
      }}
      errorPlaceholder={defaultBanner}
      ignoreAutoLoadPolicy
    />
  )
}
