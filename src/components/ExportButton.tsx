import { useState } from 'react'
import { Button } from './ui/controls'
import { DownloadIcon } from './ui/icons'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { Theme } from '@/theme/ThemeProvider'

interface Props {
  boardId: string
  boardTitle: string
  theme: Theme
  className?: string
  onError?: (message: string) => void
}

export default function ExportButton({ boardId, boardTitle, theme, className, onError }: Props) {
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { blob, filename } = await api.exportBoard(boardId, theme)
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

  return (
    <Button
      type="button"
      variant="icon"
      className={cn(className)}
      onClick={() => void handleClick()}
      disabled={busy}
      title={busy ? 'Exporting boards…' : `Export “${boardTitle}” and nested boards as PNGs`}
      aria-label={busy ? 'Exporting boards' : `Export ${boardTitle} and nested boards as PNGs`}
      aria-busy={busy}
    >
      <DownloadIcon size={15} />
    </Button>
  )
}
