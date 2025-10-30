import { generateImageByPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import Image from '../Image'

export default function ProfileBanner({
  pubkey,
  banner,
  className
}: {
  pubkey: string
  banner?: string
  className?: string
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
    <Image
      image={{ url: bannerUrl, pubkey }}
      alt={`${pubkey} banner`}
      className={cn('rounded-none', className)}
      errorPlaceholder={defaultBanner}
    />
  )
}
