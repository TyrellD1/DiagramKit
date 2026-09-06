import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MenuItem, menuClass } from './ui/controls'
import { CopyIcon, DuplicateIcon, PencilIcon } from './ui/icons'
import { cn } from '@/lib/cn'

export default function NodeContextMenu({
  position,
  onCopy,
  onDuplicate,
  onEdit,
  onClose,
}: {
  position: { x: number; y: number }
  onCopy: () => void
  onDuplicate: () => void
  onEdit: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(position)

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

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={e => { e.preventDefault(); onClose() }}
      />
      <div
        ref={ref}
        role="menu"
        aria-label="Node actions"
        className={cn('animate-pop fixed z-50 min-w-[168px]', menuClass)}
        style={{ left: pos.x, top: pos.y }}
      >
        <MenuItem role="menuitem" icon={<CopyIcon size={14} />} onClick={onCopy}>
          Copy
        </MenuItem>
        <MenuItem role="menuitem" icon={<DuplicateIcon size={14} />} onClick={onDuplicate}>
          Duplicate
        </MenuItem>
        <div className="my-1 h-px bg-border" role="separator" />
        <MenuItem role="menuitem" icon={<PencilIcon size={14} />} onClick={onEdit}>
          Edit
        </MenuItem>
      </div>
    </>
  )
}
