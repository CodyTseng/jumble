import { useTheme } from '@/providers/ThemeProvider'
import QRCodeStyling from 'qr-code-styling'
import { useEffect, useRef, useState } from 'react'

export default function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const { theme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const [foregroundColor, setForegroundColor] = useState<string | undefined>()
  const [backgroundColor, setBackgroundColor] = useState<string | undefined>()

  useEffect(() => {
    setTimeout(() => {
      const fgColor = `hsl(${getColor('foreground')})`
      const bgColor = `hsl(${getColor('background')})`
      setForegroundColor(fgColor)
      setBackgroundColor(bgColor)
    }, 0)
  }, [theme])

  useEffect(() => {
    setTimeout(() => {
      const pixelRatio = window.devicePixelRatio || 2

      const qrCode = new QRCodeStyling({
        width: size * pixelRatio,
        height: size * pixelRatio,
        data: value,
        dotsOptions: {
          type: 'dots',
          color: foregroundColor
        },
        cornersDotOptions: {
          type: 'extra-rounded',
          color: foregroundColor
        },
        cornersSquareOptions: {
          type: 'extra-rounded',
          color: foregroundColor
        },
        backgroundOptions: {
          color: backgroundColor
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
    }, 0)

    return () => {
      if (ref.current) ref.current.innerHTML = ''
    }
  }, [value, size, foregroundColor, backgroundColor])

  return <div ref={ref} />
}

function getColor(name: string) {
  if (typeof window !== 'undefined') {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  }
}
