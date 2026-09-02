import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Button, TextInput, controlClass, menuClass } from './ui/controls'
import { CheckIcon, ChevronUpDownIcon, CloseIcon, FolderIcon, SearchIcon } from './ui/icons'
import { cn } from '@/lib/cn'
import type { WorkspaceList, WorkspaceRecord } from '@/types'

export function displayPath(path: string, homeDir: string) {
  if (path === homeDir) return '~'
  if (path.startsWith(`${homeDir}/`)) return `~${path.slice(homeDir.length)}`
  return path
}

interface Props {
  workspaces: WorkspaceList
  onChanged: (next: WorkspaceList) => void | Promise<void>
}

/*
  Switching workspaces is rare, so the sidebar shows a single chip with the
  active workspace. Expanding it reveals search, the list, and attach.
*/
export default function WorkspaceSwitcher({ workspaces, onChanged }: Props) {
  const searchId = useId()
  const pathId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [attachPath, setAttachPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const active = workspaces.workspaces.find(w => w.path === workspaces.activePath)
  const activeName = active?.name ?? 'Workspace'
  const activePath = displayPath(workspaces.activePath, workspaces.homeDir)

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus())
    else {
      setQuery('')
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return workspaces.workspaces
    return workspaces.workspaces.filter(w =>
      w.name.toLowerCase().includes(q)
      || w.path.toLowerCase().includes(q)
      || displayPath(w.path, workspaces.homeDir).toLowerCase().includes(q),
    )
  }, [query, workspaces])

  const run = async (fn: () => Promise<WorkspaceList>) => {
    setBusy(true)
    setError(null)
    try {
      await onChanged(await fn())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleAttach = () => {
    const path = attachPath.trim()
    if (!path || busy) return
    void run(async () => {
      const next = await api.attachWorkspace({ path })
      setAttachPath('')
      return next
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-md px-2 h-10 text-left cursor-pointer border border-transparent bg-transparent',
          'transition-colors duration-150 hover:bg-elevated',
          open && 'bg-elevated',
        )}
        title="Switch workspace"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <FolderIcon size={14} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-text">{activeName}</span>
          <span className="truncate font-mono text-[10.5px] text-faint">{activePath}</span>
        </span>
        <ChevronUpDownIcon size={14} className="shrink-0 text-faint transition-colors group-hover:text-muted" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Workspaces"
          className={cn('animate-pop absolute left-0 right-0 top-full z-20 mt-1 flex flex-col gap-2.5 p-2', menuClass)}
        >
          <div className="relative">
            <SearchIcon size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              ref={searchRef}
              id={searchId}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Find a workspace"
              aria-label="Search workspaces"
              className={cn(controlClass, 'pl-8 py-1.5 text-xs')}
            />
          </div>

          <ul className="m-0 flex max-h-44 flex-col gap-px overflow-y-auto p-0 list-none">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-xs text-faint">No matching workspaces</li>
            ) : (
              filtered.map(space => (
                <WorkspaceRow
                  key={space.id}
                  space={space}
                  active={space.path === workspaces.activePath}
                  homeDir={workspaces.homeDir}
                  busy={busy}
                  onSwitch={() => run(() => api.switchWorkspace({ id: space.id })).then(() => setOpen(false))}
                  onDetach={() => run(() => api.detachWorkspace(space.id))}
                />
              ))
            )}
          </ul>

          <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
            <label htmlFor={pathId} className="text-2xs font-medium text-muted">Attach a folder</label>
            <div className="flex gap-1.5">
              <TextInput
                id={pathId}
                value={attachPath}
                onChange={e => setAttachPath(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAttach()
                  }
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder="~/notes/diagrams"
                className="py-1.5 text-xs font-mono"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!attachPath.trim() || busy}
                className="!h-auto shrink-0"
                onClick={handleAttach}
              >
                Attach
              </Button>
            </div>
            <p className="m-0 text-2xs leading-snug text-faint">Created if it does not exist yet.</p>
          </div>

          {error ? <p className="m-0 rounded-md bg-danger-soft px-2 py-1.5 text-2xs text-danger">{error}</p> : null}
        </div>
      )}
    </div>
  )
}

function WorkspaceRow({
  space,
  active,
  homeDir,
  busy,
  onSwitch,
  onDetach,
}: {
  space: WorkspaceRecord
  active: boolean
  homeDir: string
  busy: boolean
  onSwitch: () => void
  onDetach: () => void
}) {
  return (
    <li className={cn('group/row flex items-center gap-1 rounded-md', active && 'bg-elevated')}>
      <button
        type="button"
        disabled={busy || active}
        onClick={onSwitch}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left bg-transparent border-none',
          active ? 'cursor-default' : 'cursor-pointer hover:bg-elevated',
        )}
      >
        <span className="flex w-3.5 shrink-0 items-center justify-center text-accent">
          {active ? <CheckIcon size={13} /> : null}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-xs font-medium text-text">{space.name}</span>
          <span className="truncate font-mono text-[10.5px] text-faint">{displayPath(space.path, homeDir)}</span>
        </span>
      </button>
      {space.kind === 'attached' && (
        <Button
          type="button"
          variant="icon"
          size="sm"
          disabled={busy}
          onClick={onDetach}
          className="mr-0.5 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 hover:!text-danger"
          title="Detach workspace"
          aria-label={`Detach ${space.name}`}
        >
          <CloseIcon size={12} />
        </Button>
      )}
    </li>
  )
}
