import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { isTouchDevice } from '@/lib/common'
import { TImageInfo } from '@/types'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
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
    <div className="relative space-y-2">
      <Carousel className="w-full" setApi={setApi}>
        <CarouselContent className="xl:px-4">
          {images.map((image, index) => (
            <CarouselItem key={index} className="xl:basis-2/3 cursor-zoom-in">
              <Image
                className="xl:rounded-lg"
                image={image}
                onClick={(e) => handlePhotoClick(e, index)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {!isTouchDevice() && (
        <ArrowButton total={images.length} currentIndex={currentIndex} onClick={onDotClick} />
      )}
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
    </div>
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
          className={`w-2 h-2 rounded-full cursor-pointer ${index === currentIndex ? 'bg-foreground/40' : 'bg-muted'}`}
          onClick={() => onClick(index)}
        />
      ))}
    </div>
  )
}

function ArrowButton({
  total,
  currentIndex,
  onClick
}: {
  total: number
  currentIndex: number
  onClick: (index: number) => void
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity">
      <div className="w-full flex justify-between px-2 xl:px-4">
        <button
          onClick={() => onClick(currentIndex - 1)}
          className="w-8 h-8 rounded-full bg-background/50 flex justify-center items-center pointer-events-auto disabled:pointer-events-none disabled:opacity-0"
          disabled={currentIndex === 0}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onClick(currentIndex + 1)}
          className="w-8 h-8 rounded-full bg-background/50 flex justify-center items-center pointer-events-auto disabled:pointer-events-none disabled:opacity-0"
          disabled={currentIndex === total - 1}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
