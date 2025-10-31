import storage from '@/services/local-storage.service'
import { TColorPalette } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'

type ColorPaletteProviderProps = {
  children: React.ReactNode
}

type ColorPaletteProviderState = {
  colorPalette: TColorPalette
  setColorPalette: (palette: TColorPalette) => void
}

const ColorPaletteProviderContext = createContext<ColorPaletteProviderState | undefined>(
  undefined
)

export function ColorPaletteProvider({ children }: ColorPaletteProviderProps) {
  const [colorPalette, setColorPaletteState] = useState<TColorPalette>('default')

  useEffect(() => {
    const init = async () => {
      const palette = storage.getColorPalette()
      setColorPaletteState(palette)
      updateCSSClass(palette)
    }

    init()
  }, [])

  const updateCSSClass = (palette: TColorPalette) => {
    const root = window.document.documentElement
    // Remove all palette classes
    root.classList.remove(
      'palette-default',
      'palette-slate',
      'palette-gray',
      'palette-zinc',
      'palette-neutral',
      'palette-stone'
    )
    // Add the selected palette class
    root.classList.add(`palette-${palette}`)
  }

  const setColorPalette = (palette: TColorPalette) => {
    storage.setColorPalette(palette)
    setColorPaletteState(palette)
    updateCSSClass(palette)
  }

  return (
    <ColorPaletteProviderContext.Provider
      value={{
        colorPalette,
        setColorPalette
      }}
    >
      {children}
    </ColorPaletteProviderContext.Provider>
  )
}

export const useColorPalette = () => {
  const context = useContext(ColorPaletteProviderContext)

  if (context === undefined)
    throw new Error('useColorPalette must be used within a ColorPaletteProvider')

  return context
}
