import { useState } from 'react'
import { Button, chromeClass } from './ui/controls'
import { DownloadIcon } from './ui/icons'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { Theme } from '@/theme/ThemeProvider'

const STORAGE_KEY = 'diagramkit-export-children'

function readStoredChildren(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === '0' || stored === 'false') return false
  } catch {
    // ignore
  }
  return true
}

function writeStoredChildren(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // ignore
  }
}

interface Props {
  boardId: string
  boardTitle: string
  theme: Theme
  className?: string
  onError?: (message: string) => void
}

export default function ExportButton({ boardId, boardTitle, theme, className, onError }: Props) {
  const [busy, setBusy] = useState(false)
  const [children, setChildren] = useState(readStoredChildren)

  const setIncludeChildren = (next: boolean) => {
    setChildren(next)
    writeStoredChildren(next)
  }

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { blob, filename } = await api.exportBoard(boardId, theme, { children })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const label = busy
    ? 'Exporting boards'
    : children
      ? `Export ${boardTitle} and nested boards as PNGs`
      : `Export ${boardTitle} as PNG`

  return (
    <div className="group/export relative">
      <div
        className={cn(
          'absolute right-full top-0 flex h-8 items-center',
          'pointer-events-none opacity-0 translate-x-1.5',
          'transition-[opacity,transform] duration-150 ease-out',
          'group-hover/export:pointer-events-auto group-hover/export:opacity-100 group-hover/export:translate-x-0',
          'group-focus-within/export:pointer-events-auto group-focus-within/export:opacity-100 group-focus-within/export:translate-x-0',
          busy && 'pointer-events-auto opacity-100 translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-8 items-center gap-2 px-2.5 whitespace-nowrap',
            chromeClass,
          )}
        >
          <span className="text-xs font-medium text-text select-none">Children</span>
          <button
            type="button"
            role="switch"
            aria-checked={children}
            aria-label="Download nested boards"
            disabled={busy}
            onClick={() => setIncludeChildren(!children)}
            className={cn(
              'relative h-[18px] w-[30px] shrink-0 rounded-full border cursor-pointer',
              'transition-[background-color,border-color] duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              children ? 'border-accent bg-accent' : 'border-border bg-field',
            )}
          >
            <span
              className={cn(
                'pointer-events-none absolute top-[2px] left-[2px] h-[12px] w-[12px] rounded-full',
                'transition-transform duration-150',
                children ? 'translate-x-[14px] bg-accent-fg' : 'translate-x-0 bg-text',
              )}
            />
          </button>
        </div>
        <div className="h-8 w-1.5 shrink-0" aria-hidden />
      </div>
      <Button
        type="button"
        variant="icon"
        className={cn(className)}
        onClick={() => void handleClick()}
        disabled={busy}
        title={busy ? 'Exporting boards…' : children ? `Export “${boardTitle}” and nested boards as PNGs` : `Export “${boardTitle}” as PNG`}
        aria-label={label}
        aria-busy={busy}
      >
        <DownloadIcon size={15} />
      </Button>
    </div>
  )
}
