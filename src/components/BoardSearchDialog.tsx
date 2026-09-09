import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button, Kbd } from './ui/controls'
import { BoardIcon, CheckIcon, CloseIcon, SearchIcon } from './ui/icons'
import { api } from '@/lib/api'
import { filterBoardHits } from '@/lib/boardSearch'
import { cn } from '@/lib/cn'
import type { BoardSearchHit, WorkspaceList } from '@/types'

export function BoardSearchButton({
  open,
  onClick,
  className,
}: {
  open: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="icon"
      className={className}
      onClick={onClick}
      title="Search boards (⌘P)"
      aria-label="Search boards"
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <SearchIcon size={15} />
    </Button>
  )
}

export default function BoardSearchDialog({
  workspaces,
  currentBoardId,
  currentWorkspaceId,
  onOpen,
  onClose,
}: {
  workspaces: WorkspaceList
  currentBoardId: string | null
  currentWorkspaceId: string
  onOpen: (hit: BoardSearchHit) => void
  onClose: () => void
}) {
  const titleId = useId()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<BoardSearchHit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [enabledSpaces, setEnabledSpaces] = useState(() => workspaces.workspaces.map(w => w.id))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void api.searchBoards()
      .then(data => {
        if (cancelled) return
        setHits(data.boards)
        setError(null)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load boards')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const filtered = useMemo(
    () => filterBoardHits(hits, query, enabledSpaces),
    [hits, query, enabledSpaces],
  )

  useEffect(() => {
    setActive(0)
  }, [query, enabledSpaces, filtered.length])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active, filtered])

  const toggleSpace = (id: string) => {
    setEnabledSpaces(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id)
      return [...prev, id]
    })
  }

  const openAt = (index: number) => {
    const hit = filtered[index]
    if (hit) onOpen(hit)
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-canvas/35"
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-pop absolute left-1/2 top-[12%] flex w-[min(100%-2rem,28rem)] flex-col overflow-hidden rounded-lg border border-border bg-overlay shadow-menu"
        style={{ ['--pop-x' as string]: '-50%', ['--pop-y' as string]: '0%' }}
      >
        <h2 id={titleId} className="sr-only">Search boards</h2>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <SearchIcon size={15} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive(i => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive(i => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                openAt(active)
              }
            }}
            placeholder="Search boards"
            aria-label="Search boards"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}-${filtered[active].workspaceId}` : undefined}
            className="min-w-0 flex-1 border-none bg-transparent py-3 text-sm text-text outline-none placeholder:text-faint"
          />
          <Kbd>esc</Kbd>
          <Button type="button" variant="icon" size="sm" onClick={onClose} aria-label="Close search" title="Close (Esc)">
            <CloseIcon size={15} />
          </Button>
        </div>

        {workspaces.workspaces.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
            {workspaces.workspaces.map(space => {
              const on = enabledSpaces.includes(space.id)
              return (
                <button
                  key={space.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSpace(space.id)}
                  className={cn(
                    'h-6 max-w-full truncate rounded-full border px-2 text-2xs font-medium cursor-pointer',
                    'transition-colors duration-100',
                    on
                      ? 'border-strong bg-elevated text-text'
                      : 'border-border bg-transparent text-faint hover:text-muted',
                  )}
                >
                  {space.name}
                </button>
              )
            })}
          </div>
        )}

        <div id={listId} role="listbox" aria-label="Boards" className="max-h-[min(52vh,22rem)] overflow-y-auto p-1">
          {loading && (
            <p className="m-0 px-2.5 py-3 text-sm text-faint">Loading boards</p>
          )}
          {error && (
            <p className="m-0 px-2.5 py-3 text-sm text-danger">{error}</p>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="m-0 px-2.5 py-3 text-sm text-faint">No boards match</p>
          )}
          {!loading && !error && filtered.map((hit, index) => {
            const selected = index === active
            const current = hit.id === currentBoardId && hit.workspaceId === currentWorkspaceId
            const optionId = `${listId}-${hit.id}-${hit.workspaceId}`
            return (
              <button
                key={optionId}
                ref={selected ? activeRef : undefined}
                id={optionId}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(index)}
                onClick={() => onOpen(hit)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md border-none px-2.5 py-2 text-left cursor-pointer',
                  'transition-colors duration-100',
                  selected ? 'bg-elevated' : 'bg-transparent',
                )}
              >
                <BoardIcon size={14} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text">{hit.title}</span>
                  <span className="block truncate text-2xs text-faint">{hit.workspaceName}</span>
                </span>
                {current && <CheckIcon size={14} className="shrink-0 text-muted" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
