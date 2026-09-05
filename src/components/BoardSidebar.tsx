import { useState, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { useBoards, type BoardTreeNode } from '@/hooks/useBoards'
import { api } from '@/lib/api'
import { Button, chromeClass, MenuItem, menuClass, SectionLabel, TextInput } from './ui/controls'
import { ChevronRightIcon, CloseIcon, MenuIcon, PlusIcon, TrashIcon } from './ui/icons'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import ThemeToggle from './ThemeToggle'
import DeleteBoardModal from './DeleteBoardModal'
import { cn } from '@/lib/cn'
import type { WorkspaceIndex, WorkspaceList } from '@/types'

export const SIDEBAR_WIDTH = 288

export function readSidebarOpen() {
  try {
    return sessionStorage.getItem('diagramkit-sidebar') === 'open'
  } catch {
    return false
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBoardId: string | null
  workspaces: WorkspaceList
  onSelectBoard: (boardId: string, title: string) => void
  onWorkspacesChange: (next: WorkspaceList) => void
  onBoardsChange: (next: WorkspaceIndex) => void
}

export default function BoardSidebar({
  open,
  onOpenChange,
  currentBoardId,
  workspaces,
  onSelectBoard,
  onWorkspacesChange,
  onBoardsChange,
}: Props) {
  const { tree, rootBoardId, loading, reload } = useBoards()
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) =>
    onOpenChange(typeof next === 'function' ? next(open) : next)
  const [composing, setComposing] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [menu, setMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const newBoardId = useId()
  const newBoardRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem('diagramkit-sidebar', open ? 'open' : 'closed')
    } catch {
      // ignore
    }
  }, [open])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  useEffect(() => {
    if (composing) requestAnimationFrame(() => newBoardRef.current?.focus())
    else setNewTitle('')
  }, [composing])

  const handleCreate = async () => {
    const title = newTitle.trim()
    if (!title || creating) return
    setCreating(true)
    try {
      const created = await api.createBoard({ title })
      setComposing(false)
      const next = await reload()
      onBoardsChange(next)
      onSelectBoard(created.id, created.title)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    await api.deleteBoard(pendingDelete.id)
    const next = await reload()
    onBoardsChange(next)
    setPendingDelete(null)
  }

  return (
    <>
      <Button
        type="button"
        variant="icon"
        onClick={() => setOpen(o => !o)}
        className={cn('fixed top-3 left-3 z-40 !text-text', !open && chromeClass)}
        title={open ? 'Close boards' : 'Boards'}
        aria-label={open ? 'Close boards' : 'Open boards'}
        aria-expanded={open}
      >
        {open ? <CloseIcon size={15} /> : <MenuIcon size={15} />}
      </Button>

      {open && (
        <aside
          className="dk-sidebar-left animate-panel-left fixed top-0 left-0 z-30 flex h-screen flex-col border-r border-border"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <div className="flex h-14 shrink-0 items-center pl-12 pr-2">
            <div className="min-w-0 flex-1">
              <WorkspaceSwitcher workspaces={workspaces} onChanged={onWorkspacesChange} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <SectionLabel
              className="h-8 px-2"
              trailing={
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  onClick={() => setComposing(c => !c)}
                  title="New board"
                  aria-label="New board"
                  aria-expanded={composing}
                  className={cn('-mr-1', composing && 'bg-elevated text-text')}
                >
                  <PlusIcon size={14} className={cn('transition-transform duration-150', composing && 'rotate-45')} />
                </Button>
              }
            >
              Boards
            </SectionLabel>

            {composing && (
              <form
                onSubmit={(e) => { e.preventDefault(); void handleCreate() }}
                className="animate-fade mb-1.5 px-1"
              >
                <TextInput
                  ref={newBoardRef}
                  id={newBoardId}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setComposing(false)
                    }
                  }}
                  placeholder="Board name"
                  autoComplete="off"
                  aria-label="New board name"
                  className="py-1.5"
                />
                <p className="m-0 mt-1.5 px-0.5 text-2xs text-faint">
                  Enter to create, Esc to cancel
                </p>
              </form>
            )}

            <nav className="flex flex-col gap-px">
              {loading && tree.length === 0 ? (
                <p className="m-0 px-2 py-2 text-xs text-faint">Loading boards</p>
              ) : tree.length === 0 ? (
                <div className="mx-1 mt-1 rounded-md border border-dashed border-strong px-3 py-4 text-center">
                  <p className="m-0 text-xs text-muted">No boards yet</p>
                  <p className="m-0 mt-1 text-2xs text-faint">Use + above to create the first one.</p>
                </div>
              ) : (
                tree.map(node => (
                  <TreeItem
                    key={node.board.id}
                    node={node}
                    depth={0}
                    currentBoardId={currentBoardId}
                    onSelect={onSelectBoard}
                    onContextMenu={(board, x, y) => setMenu({ id: board.id, title: board.title, x, y })}
                  />
                ))
              )}
            </nav>
          </div>

          <div className="flex h-11 shrink-0 items-center justify-between border-t border-border px-3">
            <span className="text-2xs text-faint">
              {tree.length === 0 ? '' : `${countBoards(tree)} ${countBoards(tree) === 1 ? 'board' : 'boards'}`}
            </span>
            <ThemeToggle size="sm" />
          </div>
        </aside>
      )}

      {menu && (
        <BoardTreeMenu
          title={menu.title}
          isRoot={menu.id === rootBoardId}
          position={{ x: menu.x, y: menu.y }}
          onDelete={() => {
            setPendingDelete({ id: menu.id, title: menu.title })
            setMenu(null)
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {pendingDelete && (
        <DeleteBoardModal
          title={pendingDelete.title}
          onConfirm={handleDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}

function countBoards(tree: BoardTreeNode[]): number {
  return tree.reduce((sum, n) => sum + 1 + countBoards(n.children), 0)
}

function TreeItem({
  node,
  depth,
  currentBoardId,
  onSelect,
  onContextMenu,
}: {
  node: BoardTreeNode
  depth: number
  currentBoardId: string | null
  onSelect: (boardId: string, title: string) => void
  onContextMenu: (board: { id: string; title: string }, x: number, y: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isActive = node.board.id === currentBoardId
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group/item flex h-7 items-center gap-0.5 rounded-md pr-2 text-sm transition-colors duration-100',
          isActive ? 'bg-elevated text-text' : 'text-muted hover:bg-elevated hover:text-text',
        )}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
        <button
          type="button"
          tabIndex={hasChildren ? 0 : -1}
          aria-hidden={!hasChildren}
          onClick={(e) => { e.stopPropagation(); setExpanded(ex => !ex) }}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-none bg-transparent p-0 text-faint',
            hasChildren ? 'cursor-pointer hover:text-text hover:bg-border' : 'pointer-events-none opacity-0',
          )}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRightIcon size={12} className={cn('transition-transform duration-150', expanded && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.board.id, node.board.title)}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onContextMenu(node.board, e.clientX, e.clientY)
          }}
          className={cn(
            'min-w-0 flex-1 truncate border-none bg-transparent p-0 py-1 text-left cursor-pointer',
            isActive && 'font-medium',
          )}
          aria-current={isActive ? 'page' : undefined}
        >
          {node.board.title}
        </button>
      </div>

      {hasChildren && expanded && (
        <div className="relative">
          {node.children.map(child => (
            <TreeItem
              key={child.board.id}
              node={child}
              depth={depth + 1}
              currentBoardId={currentBoardId}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BoardTreeMenu({
  title,
  isRoot,
  position,
  onDelete,
  onClose,
}: {
  title: string
  isRoot: boolean
  position: { x: number; y: number }
  onDelete: () => void
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
        aria-label={`${title} actions`}
        className={cn('animate-pop fixed z-50 min-w-[168px]', menuClass)}
        style={{ left: pos.x, top: pos.y }}
      >
        <MenuItem
          role="menuitem"
          destructive
          disabled={isRoot}
          title={isRoot ? 'The Home board cannot be deleted' : `Delete ${title}`}
          icon={<TrashIcon size={14} />}
          className={isRoot ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : undefined}
          onClick={() => { if (!isRoot) onDelete() }}
        >
          Delete
        </MenuItem>
      </div>
    </>
  )
}
