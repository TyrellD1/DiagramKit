import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useBoards } from '@/hooks/useBoards'
import { cn } from '@/lib/cn'
import { controlClass, menuClass } from './ui/controls'
import { CloseIcon, LayersIcon } from './ui/icons'

interface Props {
  id?: string
  value: string
  onChange: (boardId: string) => void
  placeholder?: string
}

export default function BoardAutocomplete({ id, value, onChange, placeholder = 'Search boards' }: Props) {
  const { boards, loading } = useBoards()
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const selectedBoard = boards.find(b => b.id === value)

  useEffect(() => {
    if (!open) setQuery(selectedBoard?.title ?? '')
  }, [selectedBoard?.title, value, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return boards
    return boards.filter(b => b.title.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
  }, [boards, query])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(selectedBoard?.title ?? '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selectedBoard?.title])

  const handleSelect = (boardId: string) => {
    onChange(boardId)
    const title = boards.find(b => b.id === boardId)?.title ?? ''
    setQuery(title)
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setQuery('')
    setOpen(true)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight(i => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setHighlight(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault()
        handleSelect(filtered[highlight].id)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setQuery(selectedBoard?.title ?? '')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={open ? query : (selectedBoard?.title ?? query)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (value) onChange('')
          }}
          onFocus={() => {
            setOpen(true)
            setQuery(selectedBoard?.title ?? query)
            requestAnimationFrame(() => inputRef.current?.select())
          }}
          onKeyDown={onKeyDown}
          placeholder={loading ? 'Loading boards' : placeholder}
          autoComplete="off"
          className={cn(controlClass, 'pr-8')}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border-none bg-transparent p-0 text-faint cursor-pointer transition-colors hover:bg-elevated hover:text-text"
            title="Clear board"
            aria-label="Clear selected board"
          >
            <CloseIcon size={12} />
          </button>
        ) : null}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Boards"
          className={cn('animate-fade absolute top-full left-0 right-0 z-30 m-0 mt-1 max-h-52 list-none overflow-y-auto', menuClass)}
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-xs text-faint">
              {loading ? 'Loading boards' : 'No matching boards'}
            </li>
          ) : (
            filtered.map((board, index) => (
              <li key={board.id} role="option" aria-selected={board.id === value || index === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => handleSelect(board.id)}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm border-none cursor-pointer transition-colors duration-100',
                    index === highlight ? 'bg-elevated text-text' : 'bg-transparent text-text',
                  )}
                >
                  <LayersIcon size={13} className={cn('shrink-0', board.id === value ? 'text-accent' : 'text-faint')} />
                  <span className="truncate">{board.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
