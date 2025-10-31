import QRCodeStyling from 'qr-code-styling'
import { useEffect, useRef } from 'react'
import iconSvg from '../../assets/favicon.svg'

export default function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const pixelRatio = window.devicePixelRatio || 2

      const qrCode = new QRCodeStyling({
        qrOptions: {
          errorCorrectionLevel: 'M'
        },
        image: iconSvg,
        width: size * pixelRatio,
        height: size * pixelRatio,
        data: value,
        dotsOptions: {
          color: '#000000',
          type: 'extra-rounded'
        },
        backgroundOptions: {
          color: '#ffffff'
        },
        cornersSquareOptions: {
          color: '#000000',
          type: 'extra-rounded'
        },
        cornersDotOptions: {
          color: '#000000',
          type: 'extra-rounded'
        },
        imageOptions: {
          crossOrigin: 'anonymous',
          margin: 5
        }
      })

      if (ref.current) {
        ref.current.innerHTML = ''
        qrCode.append(ref.current)
        const canvas = ref.current.querySelector('canvas')
        if (canvas) {
          canvas.style.width = `${size}px`
          canvas.style.height = `${size}px`
          canvas.style.maxWidth = '100%'
          canvas.style.height = 'auto'
        }
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      if (ref.current) ref.current.innerHTML = ''
    }
  }, [value, size])

  return (
    <div className="rounded-2xl overflow-hidden p-2 bg-white">
      <div ref={ref} />
    </div>
  )
}
