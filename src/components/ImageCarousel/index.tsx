import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { TImageInfo } from '@/types'
import { useEffect, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'
import NsfwOverlay from '../NsfwOverlay'

export function ImageCarousel({
  images,
  isNsfw = false
}: {
  images: TImageInfo[]
  isNsfw?: boolean
}) {
  const [api, setApi] = useState<CarouselApi>()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState(-1)

  useEffect(() => {
    if (!api) {
      return
    }

    setCurrentIndex(api.selectedScrollSnap())

    api.on('select', () => {
      setCurrentIndex(api.selectedScrollSnap())
    })
  }, [api])

  const handlePhotoClick = (event: React.MouseEvent, current: number) => {
    event.preventDefault()
    setLightboxIndex(current)
  }

  const onDotClick = (index: number) => {
    api?.scrollTo(index)
    setCurrentIndex(index)
  }

  return (
    <>
      <Carousel className="w-full" setApi={setApi}>
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem key={index}>
              <Image image={image} onClick={(e) => handlePhotoClick(e, index)} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {images.length > 1 && (
        <CarouselDot total={images.length} currentIndex={currentIndex} onClick={onDotClick} />
      )}
      <Lightbox
        index={lightboxIndex}
        slides={images.map(({ url }) => ({ src: url }))}
        plugins={[Zoom]}
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        controller={{
          closeOnBackdropClick: true,
          closeOnPullUp: true,
          closeOnPullDown: true
        }}
        styles={{ toolbar: { paddingTop: '2.25rem' } }}
      />
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </>
  )
}

function CarouselDot({
  total,
  currentIndex,
  onClick
}: {
  total: number
  currentIndex: number
  onClick: (index: number) => void
}) {
  return (
    <div className="w-full flex gap-1 justify-center">
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={`w-2 h-2 rounded-full ${index === currentIndex ? 'bg-foreground/40' : 'bg-muted'}`}
          onClick={() => onClick(index)}
        />
      ))}
    </div>
  )
}
