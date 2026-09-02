import { Fragment } from 'react'
import { chromeClass } from './ui/controls'
import { ChevronRightIcon } from './ui/icons'
import { cn } from '@/lib/cn'

interface BoardStackEntry {
  boardId: string
  boardTitle: string
}

interface Props {
  stack: BoardStackEntry[]
  onNavigate: (index: number) => void
  /** Left offset in px; grows when the sidebar is open so the chip stays visible. */
  offsetLeft?: number
}

/*
  Always visible so the user knows which board they are on, even at the root.
  Earlier entries are clickable; the current one is plain text.
*/
export default function BoardBreadcrumbs({ stack, onNavigate, offsetLeft = 56 }: Props) {
  if (stack.length === 0) return null

  return (
    <nav
      aria-label="Board path"
      className={cn(
        'fixed top-3 z-20 flex h-8 max-w-[min(60vw,640px)] items-center gap-0.5 px-2.5 text-sm transition-[left] duration-200 ease-out',
        chromeClass,
      )}
      style={{ left: offsetLeft }}
    >
      {stack.map((entry, i) => {
        const isLast = i === stack.length - 1
        return (
          <Fragment key={`${entry.boardId}-${i}`}>
            {i > 0 && <ChevronRightIcon size={12} className="shrink-0 text-faint" />}
            {isLast ? (
              <span className="truncate px-1 font-medium text-text" aria-current="page">{entry.boardTitle}</span>
            ) : (
              <button
                type="button"
                className="max-w-[12rem] truncate rounded border-none bg-transparent px-1 py-0.5 text-muted cursor-pointer transition-colors hover:bg-elevated hover:text-text"
                onClick={() => onNavigate(i)}
                title={`Back to ${entry.boardTitle}`}
              >
                {entry.boardTitle}
              </button>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
