import { Button } from './ui/controls'
import { MoonIcon, SunIcon } from './ui/icons'
import { colorModeOf, useTheme } from '@/theme/ThemeProvider'

export default function ThemeToggle({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const { theme, toggle } = useTheme()
  const isDark = colorModeOf(theme) === 'dark'

  return (
    <Button
      type="button"
      variant="icon"
      size={size}
      className={className}
      onClick={toggle}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
    </Button>
  )
}
