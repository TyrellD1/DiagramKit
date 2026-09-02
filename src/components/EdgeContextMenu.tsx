import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MenuItem, menuClass } from './ui/controls'
import { ArrowRightIcon, TrashIcon } from './ui/icons'
import { cn } from '@/lib/cn'

interface EdgeContextMenuProps {
  edgeId: string
  edgeType: string
  position: { x: number; y: number }
  onToggleType: (edgeId: string, newType: string) => void
  onDelete: (edgeId: string) => void
  onClose: () => void
}

const ConnectorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    <path d="M3 8h10" />
    <circle cx="3" cy="8" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="13" cy="8" r="1.25" fill="currentColor" stroke="none" />
  </svg>
)

export default function EdgeContextMenu({ edgeId, edgeType, position, onToggleType, onDelete, onClose }: EdgeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(position)

  // Keep the menu inside the viewport when the edge sits near an edge of the window.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(position.x, window.innerWidth - rect.width - 8)
    const y = Math.min(position.y, window.innerHeight - rect.height - 8)
    setPos({ x: Math.max(8, x), y: Math.max(8, y) })
  }, [position])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isArrow = edgeType === 'default'

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div
        ref={ref}
        role="menu"
        aria-label="Edge actions"
        className={cn('animate-pop fixed z-40 min-w-[180px]', menuClass)}
        style={{ left: pos.x, top: pos.y }}
      >
        <MenuItem
          role="menuitem"
          icon={isArrow ? <ConnectorIcon /> : <ArrowRightIcon size={14} />}
          onClick={() => onToggleType(edgeId, isArrow ? 'plain' : 'default')}
        >
          {isArrow ? 'Remove arrowhead' : 'Add arrowhead'}
        </MenuItem>
        <div className="my-1 h-px bg-border" role="separator" />
        <MenuItem role="menuitem" destructive icon={<TrashIcon size={14} />} onClick={() => onDelete(edgeId)}>
          Delete edge
        </MenuItem>
      </div>
    </>
  )
}
