# Board Creation & Navigation — Side Panel

## Overview

Add a collapsible left side panel that lets users browse all their boards in a tree structure, navigate to any board by clicking it, and create new boards — both top-level and as children of existing boards. This replaces the current "spatial-only" navigation model (where the only way to find a board is to physically navigate into it via nodes) with a persistent directory-style navigator, similar to a file explorer.

## High Level Goals

1. **See all boards** — hierarchical tree view reflecting the `parentBoardId` relationship
2. **Navigate to any board** — click a board in the tree to load it on the canvas
3. **Create boards** — create top-level or child boards from the side panel
4. **Open/close the panel** — toggle button so the panel doesn't consume space when not needed

---

## File Paths

- `src/components/BoardSidebar.tsx` — New component. Collapsible left-side panel containing the board tree, a "create board" input, and the toggle button.
- `src/hooks/useBoards.ts` — New hook. Fetches all boards via `GET /api/boards`, exposes a flat list and a `reload()` method. Builds the tree structure from the flat `parentBoardId` data.
- `src/lib/api.ts` — Modify. Add `listBoards()` method that calls `GET /api/boards` (without `?root=true`).
- `src/components/BoardCanvas.tsx` — Modify. Accept a `navigateToBoard(boardId, title)` callback; render `BoardSidebar` alongside the canvas; wire sidebar board-click to `pushBoard`.
- `src/App.tsx` — No changes needed. The root board fetch and auth flow remain unchanged.
- `src/types.ts` — No changes needed. The existing `Board` interface already has all required fields.
- `server/src/app/api/boards/route.ts` — No changes needed. `GET /api/boards` already returns all user boards when `?root=true` is omitted.

---

## Manual Testing Plan

1. Start the dev servers: `make dev` (or `npm run dev` in both `server/` and root).
2. Sign in and land on the root board canvas.
3. **Toggle visibility**: Look for a small toggle button in the top-left area (below or beside the breadcrumbs). Click it — a side panel should slide open from the left. Click it again — it should close.
4. **Board tree**: With the panel open, verify the root board appears at the top of the tree. If there are child boards (created previously via the node editor), they should appear nested beneath their parent with indentation.
5. **Navigate via click**: Click any board name in the tree. The canvas should load that board's content, and the breadcrumbs should update to reflect the navigation stack.
6. **Create a top-level board**: In the sidebar, type a name into the "New board" input at the top and press Enter. The board should appear in the tree at root level and be immediately navigable.
7. **Create a child board**: Hover or right-click an existing board in the tree. Use the "+" button/action to create a child board. Enter a name. It should appear nested under the parent.
8. **Verify data persists**: Refresh the page. Re-open the sidebar. All boards (including newly created ones) should appear in the tree.
9. **Edge case — empty state**: If there's only the root board and no children, the tree should display just "Root" cleanly with no visual artifacts.

---

## Implementation Plan

### Architecture Decision: Where does the sidebar live?

**Option A (Recommended): Render `BoardSidebar` inside `BoardCanvas`**
The sidebar is tightly coupled to board navigation (`pushBoard`, `currentBoardId`). Rendering it inside `BoardCanvas` gives it direct access to the navigation hook without prop-drilling through `App.tsx`. The sidebar sits *beside* the React Flow canvas, not above or within it.

**Option B: Render `BoardSidebar` in `App.tsx` and pass navigation callbacks down**
This is cleaner separation but requires lifting `useBoardNavigation` out of `BoardCanvas` or passing callbacks through props. Since `useBoardNavigation` depends on `useReactFlow()` (which requires `ReactFlowProvider` context), this would mean restructuring `App.tsx` significantly. Not worth it.

**Decision:** Option A. The sidebar is a sibling to the `<ReactFlow>` element inside `BoardCanvas`.

### Architecture Decision: Tree structure — build on client or server?

The `GET /api/boards` endpoint returns a flat list of boards with `parentBoardId` fields. We need a tree for the UI.

**Option A (Recommended): Build the tree on the client**
The board count per user will be small (dozens to low hundreds). Building a tree from a flat list is trivial — a single reduce pass. No need to complicate the API.

**Option B: Add a tree endpoint on the server**
Over-engineering for a single-user desktop app. The flat list is already fetched in one query.

**Decision:** Option A. The `useBoards` hook builds the tree from the flat list.

---

### Phase 1: Data Layer

#### 1.1 Add `listBoards` to API client

**File:** `src/lib/api.ts`

Add one line to the `api` object:

```typescript
listBoards: () => request<Board[]>('/api/boards'),
```

This calls the existing `GET /api/boards` endpoint (without `?root=true`) which already returns all boards for the authenticated user.

**Notes:**
- The generic type `Board[]` uses the existing `Board` import from `@/types`.
- Need to add the `Board` import to the file.

#### 1.2 Create `useBoards` hook

**File:** `src/hooks/useBoards.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Board } from '@/types'

export interface BoardTreeNode {
  board: Board
  children: BoardTreeNode[]
}

function buildTree(boards: Board[]): BoardTreeNode[] {
  const map = new Map<string, BoardTreeNode>()
  const roots: BoardTreeNode[] = []

  // Create nodes
  for (const board of boards) {
    map.set(board.id, { board, children: [] })
  }

  // Wire parent→child
  for (const board of boards) {
    const node = map.get(board.id)!
    if (board.parentBoardId && map.has(board.parentBoardId)) {
      map.get(board.parentBoardId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([])
  const [tree, setTree] = useState<BoardTreeNode[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listBoards()
      setBoards(data)
      setTree(buildTree(data))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { boards, tree, loading, reload: load }
}
```

**Notes:**
- `buildTree` is a simple two-pass algorithm: create all nodes, then wire children to parents.
- Boards with `parentBoardId: null` become roots.
- `reload()` is exposed so the sidebar can refresh after creating a new board.

---

### Phase 2: Sidebar Component

#### 2.1 Create `BoardSidebar` component

**File:** `src/components/BoardSidebar.tsx`

```tsx
import { useState } from 'react'
import { useBoards, type BoardTreeNode } from '@/hooks/useBoards'
import { api } from '@/lib/api'

interface Props {
  currentBoardId: string | null
  onSelectBoard: (boardId: string, title: string) => void
}

export default function BoardSidebar({ currentBoardId, onSelectBoard }: Props) {
  const { tree, loading, reload } = useBoards()
  const [open, setOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async (parentBoardId?: string) => {
    const title = newTitle.trim()
    if (!title || creating) return
    setCreating(true)
    try {
      await api.createBoard({ title, parentBoardId })
      setNewTitle('')
      await reload()
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed top-3 left-3 z-20 w-8 h-8 flex items-center justify-center rounded-md bg-ctp-base/85 backdrop-blur-[8px] border border-ctp-overlay0 text-ctp-subtext0 hover:text-ctp-text hover:border-ctp-overlay1 transition-colors"
        title={open ? 'Close sidebar' : 'Open sidebar'}
      >
        {open ? '✕' : '☰'}
      </button>

      {/* Sidebar panel */}
      {open && (
        <aside className="fixed top-0 left-0 z-10 h-screen w-64 bg-ctp-mantle border-r border-ctp-overlay0 flex flex-col pt-14 shadow-lg">
          {/* Create board input */}
          <div className="px-3 pb-3 border-b border-ctp-overlay0">
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreate() }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New board…"
                className="flex-1 min-w-0 px-2 py-1.5 rounded bg-ctp-base border border-ctp-overlay0 text-ctp-text text-sm placeholder:text-ctp-surface2 outline-none focus:border-ctp-blue"
              />
              <button
                type="submit"
                disabled={!newTitle.trim() || creating}
                className="px-2 py-1.5 rounded bg-ctp-blue text-ctp-base text-sm font-medium hover:bg-ctp-sapphire disabled:opacity-40 transition-colors"
              >
                +
              </button>
            </form>
          </div>

          {/* Board tree */}
          <nav className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <p className="px-3 text-ctp-subtext0 text-sm">Loading…</p>
            ) : tree.length === 0 ? (
              <p className="px-3 text-ctp-subtext0 text-sm">No boards</p>
            ) : (
              tree.map(node => (
                <TreeItem
                  key={node.board.id}
                  node={node}
                  depth={0}
                  currentBoardId={currentBoardId}
                  onSelect={onSelectBoard}
                  onCreateChild={async (parentId) => {
                    // Prompt is handled inline — for now, use the top input
                    // A future iteration can add inline child-creation
                  }}
                />
              ))
            )}
          </nav>
        </aside>
      )}
    </>
  )
}

function TreeItem({
  node,
  depth,
  currentBoardId,
  onSelect,
}: {
  node: BoardTreeNode
  depth: number
  currentBoardId: string | null
  onSelect: (boardId: string, title: string) => void
  onCreateChild?: (parentId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isActive = node.board.id === currentBoardId
  const hasChildren = node.children.length > 0

  return (
    <div>
      <button
        onClick={() => onSelect(node.board.id, node.board.title)}
        className={`w-full text-left flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-ctp-overlay0/50 ${
          isActive ? 'text-ctp-blue bg-ctp-overlay0/30' : 'text-ctp-text'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {/* Expand/collapse toggle for nodes with children */}
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(ex => !ex) }}
            className="w-4 text-center text-ctp-subtext0 cursor-pointer select-none"
          >
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="w-4" />
        )}
        <span className="truncate">{node.board.title}</span>
      </button>

      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <TreeItem
              key={child.board.id}
              node={child}
              depth={depth + 1}
              currentBoardId={currentBoardId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Notes:**
- The toggle button is `fixed` at top-left, z-20 so it layers above both the sidebar (z-10) and the breadcrumbs (z-10). When the sidebar is closed, it serves as the sole entry point.
- The sidebar panel is `fixed` full-height, 256px wide (`w-64`), with `pt-14` to clear the toggle button area.
- Tree items use `paddingLeft` with depth-based indentation (16px per level) for the hierarchy.
- Active board is highlighted with `text-ctp-blue` and a subtle background.
- Creating a board via the top input creates it at root level (no `parentBoardId`). The `onCreateChild` prop on `TreeItem` is a placeholder for a future enhancement to create child boards inline — for now, boards can be made children of other boards via the existing NodeEditor "Link to New Board" flow.

---

### Phase 3: Integration

#### 3.1 Wire sidebar into `BoardCanvas`

**File:** `src/components/BoardCanvas.tsx`

Changes:
1. Import `BoardSidebar`.
2. Add a `handleSidebarNavigate` callback that calls `pushBoard`.
3. Render `<BoardSidebar>` as a sibling to the React Flow canvas.
4. Shift the `BoardBreadcrumbs` right when sidebar is open (or leave as-is since the sidebar has lower z-index than breadcrumbs).

```tsx
// Add import
import BoardSidebar from './BoardSidebar'

// Inside the component, add callback:
const handleSidebarNavigate = useCallback((boardId: string, title: string) => {
  pushBoard(boardId, title)
}, [pushBoard])

// In the JSX return, add sidebar before ReactFlow:
return (
  <div className="w-screen h-screen">
    <BoardSidebar
      currentBoardId={currentBoardId}
      onSelectBoard={handleSidebarNavigate}
    />
    <BoardBreadcrumbs stack={boardStack} onNavigate={popToIndex} />
    {/* ...rest of ReactFlow, NodeEditor, CreateNodeDialog unchanged */}
  </div>
)
```

**Notes:**
- `pushBoard` already saves the current viewport and animates to the new board. Using it for sidebar navigation means the stack-based navigation model is preserved — clicking a board in the sidebar pushes it onto the stack, and the user can use breadcrumbs to go back.
- The breadcrumbs component already has `z-10` positioning. Since the sidebar is also `z-10`, the breadcrumbs will render on top of the sidebar content, which is correct — they sit in the `top-3 left-3` area above the sidebar's `pt-14` content region. However, we should adjust the breadcrumbs `left` position when the sidebar is open. This can be done by passing an `isSidebarOpen` prop or by having the sidebar manage its own state and the breadcrumbs react accordingly. For simplicity, in this phase we'll let them overlap (the sidebar toggle button at `top-3 left-3` will be the primary control, and breadcrumbs already hide when there's only one board in the stack).

#### 3.2 Coordinate toggle button and breadcrumbs positioning

The sidebar toggle button sits at `top-3 left-3` (same position as `BoardBreadcrumbs`). The breadcrumbs only show when the stack has 2+ boards, so there's minimal conflict. However, when both are visible, they'll overlap.

**Fix:** Shift the breadcrumbs right when the sidebar toggle exists. The simplest approach is to move `BoardBreadcrumbs` to `left-14` (56px) to clear the 32px toggle button + gap. This is a small CSS change.

**File:** `src/components/BoardBreadcrumbs.tsx`

Change `left-3` to `left-14` in the nav class to provide clearance for the sidebar toggle:

```tsx
<nav className="absolute top-3 left-14 z-10 ...">
```

This keeps the breadcrumbs visible regardless of sidebar state and avoids complex conditional positioning.

---

### Summary of Changes by Phase

**Phase 1** (Data): Add `api.listBoards()`, create `useBoards` hook with tree-building logic.

**Phase 2** (UI): Create `BoardSidebar` component — toggle button, create-board input, recursive tree view.

**Phase 3** (Integration): Render sidebar in `BoardCanvas`, wire `pushBoard` to sidebar selection, adjust breadcrumb positioning.

No backend changes required — the existing `GET /api/boards` endpoint already returns all boards for the authenticated user.
