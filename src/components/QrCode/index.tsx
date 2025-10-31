import QRCodeStyling, { Options } from 'qr-code-styling'
import { useEffect, useRef } from 'react'
import iconSvg from '../../assets/favicon.svg'

export default function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !value) return

    const pixelRatio = window.devicePixelRatio || 2

    const options: Options = {
      type: 'canvas',
      qrOptions: {
        errorCorrectionLevel: 'M'
      },
      image: iconSvg,
      width: size * pixelRatio,
      height: size * pixelRatio,
      data: value,
      dotsOptions: {
        type: 'extra-rounded',
        color: '#000000'
      },
      cornersDotOptions: {
        type: 'extra-rounded',
        color: '#000000'
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
        color: '#000000'
      },
      backgroundOptions: {
        color: '#ffffff'
      },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 5
      }
    }

    const qrCode = new QRCodeStyling(options)

    ref.current.innerHTML = ''
    qrCode.append(ref.current)

    const canvas = ref.current.querySelector('canvas')
    if (canvas) {
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      canvas.style.maxWidth = '100%'
      canvas.style.height = 'auto'
    }

    return () => {
      if (ref.current) ref.current.innerHTML = ''
    }
  }, [value, size])

  return (
    <div className="rounded-2xl overflow-hidden p-2 bg-white">
      <div ref={ref} />
    </div>
  )
}
