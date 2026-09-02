import { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'

export interface ThemeColors {
  canvas: string
  surface: string
  grid: string
  accent: string
  muted: string
  faint: string
  minimapMask: string
}

function readColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string) => styles.getPropertyValue(name).trim()
  return {
    canvas: read('--canvas'),
    surface: read('--surface'),
    grid: read('--grid'),
    accent: read('--accent'),
    muted: read('--muted'),
    faint: read('--faint'),
    minimapMask: read('--minimap-mask'),
  }
}

export function useThemeColors(): ThemeColors {
  const { theme } = useTheme()
  const [colors, setColors] = useState<ThemeColors>(readColors)

  useEffect(() => {
    setColors(readColors())
  }, [theme])

  return colors
}
