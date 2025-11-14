import { generateImageByPubkey } from '@/lib/pubkey'
import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import modalManager from '@/services/modal-manager.service'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
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

export function BannerWithLightbox({
  pubkey,
  banner,
  className
}: {
  pubkey: string
  banner?: string
  className?: string
}) {
  const id = useMemo(() => `profile-banner-lightbox-${randomString()}`, [])
  const defaultBanner = useMemo(() => generateImageByPubkey(pubkey), [pubkey])
  const [bannerUrl, setBannerUrl] = useState(banner ?? defaultBanner)
  const [index, setIndex] = useState(-1)

  useEffect(() => {
    if (banner) {
      setBannerUrl(banner)
    } else {
      setBannerUrl(defaultBanner)
    }
  }, [defaultBanner, banner])

  useEffect(() => {
    if (index >= 0) {
      modalManager.register(id, () => {
        setIndex(-1)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [index, id])

  const handleBannerClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    setIndex(0)
  }

  return (
    <>
      <Image
        image={{ url: bannerUrl, pubkey }}
        alt={`${pubkey} banner`}
        className={cn('rounded-none', className)}
        classNames={{
          wrapper: 'cursor-zoom-in'
        }}
        errorPlaceholder={defaultBanner}
        onClick={handleBannerClick}
      />
      {index >= 0 &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              index={index}
              slides={[{ src: bannerUrl }]}
              plugins={[Zoom]}
              open={index >= 0}
              close={() => setIndex(-1)}
              controller={{
                closeOnBackdropClick: true,
                closeOnPullUp: true,
                closeOnPullDown: true
              }}
              styles={{
                toolbar: { paddingTop: '2.25rem' }
              }}
            />
          </div>,
          document.body
        )}
    </>
  )
}
