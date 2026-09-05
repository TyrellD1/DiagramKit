export const THEMES = ['light', 'dark', 'light-gray', 'dark-gray'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  'light-gray': 'Light grayscale',
  'dark-gray': 'Dark grayscale',
}

export const THEME_COLOR: Record<Theme, string> = {
  light: '#f3eee6',
  dark: '#211f1c',
  'light-gray': '#f4f4f4',
  'dark-gray': '#1c1c1c',
}

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'light-gray' || value === 'dark-gray'
}

export function colorModeOf(theme: Theme): 'light' | 'dark' {
  return theme === 'light' || theme === 'light-gray' ? 'light' : 'dark'
}

export function toggleTheme(theme: Theme): Theme {
  if (theme === 'light') return 'dark'
  if (theme === 'dark') return 'light'
  if (theme === 'light-gray') return 'dark-gray'
  return 'light-gray'
}

export function parseTheme(value: string | null | undefined): Theme | null {
  return isTheme(value) ? value : null
}
