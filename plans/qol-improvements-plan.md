# QoL Improvements Plan

## Overview

Three quality-of-life improvements covering reference link types, better node rendering, and edge interactions.

## High Level Goals

1. **Reference Link Types** — Reference links gain the same action types as child links (url, cursor, open, board) instead of being plain name+url pairs
2. **Better Nodes** — Wider nodes, markdown descriptions with whitespace preservation, larger/scrollable editor sidebar
3. **Edge Direction & Deleting** — Click an edge to toggle arrow vs plain connector, persist edge deletion to the database

---

## File Paths

### Files to Create
- `src/components/EdgeContextMenu.tsx` — Floating menu shown on edge click for toggling direction and deleting
- `server/src/db/migrations/0003_reference_link_types.sql` — Migration to add `type` and `path` columns to reference_links table
- `server/src/db/migrations/0004_edge_type.sql` — Migration to add `edge_type` column to edges table

### Files to Modify
- `server/src/db/schema.ts` — Add `type` and `path` columns to referenceLinks, `edgeType` column to edges
- `src/types.ts` — Update ReferenceLink interface with type/path fields, update Edge interface with edgeType field
- `server/src/app/api/nodes/[id]/references/route.ts` — Accept `type` and `path` in POST handler
- `server/src/app/api/edges/route.ts` — Accept `edgeType` in POST handler
- `server/src/app/api/edges/[id]/route.ts` — Add PATCH handler for updating edgeType
- `src/lib/api.ts` — Add `updateEdge` method, update `createReferenceLink` types
- `src/components/AtreidesNode.tsx` — Increase max-width to 480px, remove line-clamp, render markdown descriptions, handle reference link action types
- `src/components/NodeEditor.tsx` — Add type selector to reference links, increase textarea rows to 9, widen sidebar to w-[480px]
- `src/components/BoardCanvas.tsx` — Wire up edge click context menu, persist edge deletions via API, pass edgeType to edge creation
- `src/hooks/useBoard.ts` — Map edgeType to React Flow edge `type` and `markerEnd` properties

---

## Manual Testing Plan

1. Start both servers: `npm run dev` and `npm run dev:server`
2. Open the app and navigate to a board with nodes

**Reference Link Types:**
3. Click a node to open the editor sidebar
4. In the Reference Links section, verify the type dropdown appears (URL, Cursor, Open, Board)
5. Add a reference link with type "Cursor" and a path like `/path/to/project` — verify it saves
6. On the node card, verify the reference link renders with appropriate styling (not just a plain URL link)
7. Click the reference link on the node — verify it executes the correct action (opens Cursor for cursor type, etc.)
8. Add a reference link with type "Board" — verify the BoardAutocomplete appears for value input
9. Add a reference link with type "URL" — verify it behaves like the existing url-only links

**Better Nodes:**
10. Create a node with a long multi-line description using markdown (bold, lists, code blocks)
11. Verify the node card renders the markdown properly with whitespace respected
12. Verify the node card is wider (up to ~480px) and description is not truncated
13. Click a node to open the editor — verify the sidebar is wider (~480px)
14. Verify the description textarea is ~3x taller (~9 rows)
15. Add enough content that the sidebar overflows — verify it scrolls

**Edge Direction & Deleting:**
16. Create an edge between two nodes by dragging from a handle
17. Click on the edge — verify a context menu appears
18. In the context menu, toggle between "Arrow" (directed) and "Connector" (plain line) — verify the edge updates visually
19. Reload the page — verify the edge direction choice persisted
20. Click an edge again and select "Delete" — verify the edge disappears
21. Reload the page — verify the deleted edge is gone (persisted to DB)

---

## Implementation Plan

### Architecture Decision: Reference Link Type Storage

**Option A (Recommended): Add `type` and `path` columns to `reference_links` table.**
The existing `url` column stays and is used for URL-type links. A new `type` column (`text`, default `'url'`) indicates the link type. A `path` column stores the value for cursor/open types. For board type, `url` stores the boardId. This is backward-compatible — existing links default to type `url` and keep working.

**Option B: Store as JSONB like childLink.**
Over-engineered for this case. Reference links are simple flat records, not discriminated unions with different shapes. Columns are simpler to query and migrate.

Going with Option A.

### Architecture Decision: Edge Type Persistence

**Option A (Recommended): Add `edge_type` column to `edges` table.**
Stores `'default'` (arrow/directed) or `'plain'` (no arrow/connector). Default value is `'default'` so existing edges get arrows. Simple column addition, simple PATCH endpoint.

**Option B: Store in the `label` field as JSON.**
Hacky. The label field is for labels.

Going with Option A.

### Architecture Decision: Edge Context Menu

**Option A (Recommended): Custom floating menu on edge click.**
A lightweight positioned div that appears at click coordinates. Contains two buttons: toggle direction and delete. Disappears on click away. No heavy library needed.

**Option B: Custom edge component with built-in controls.**
More complex, requires re-implementing edge rendering. Overkill for two actions.

Going with Option A.

---

### Phase 1: Database & API Layer

#### 1.1 Migration — Reference Link Types

**File:** `server/src/db/migrations/0003_reference_link_types.sql`

```sql
-- Migration: Reference Link Types
-- Adds type and path columns to reference_links table
-- so reference links can support cursor, open, and board actions like child links

ALTER TABLE reference_links ADD COLUMN type TEXT NOT NULL DEFAULT 'url';
ALTER TABLE reference_links ADD COLUMN path TEXT;
```

#### 1.2 Migration — Edge Type

**File:** `server/src/db/migrations/0004_edge_type.sql`

```sql
-- Migration: Edge Type
-- Adds edge_type column to edges table for arrow vs plain connector

ALTER TABLE edges ADD COLUMN edge_type TEXT NOT NULL DEFAULT 'default';
```

#### 1.3 Update Database Schema

**File:** `server/src/db/schema.ts`

Add to `referenceLinks` table:
```typescript
type: text('type').notNull().default('url'),     // 'url' | 'cursor' | 'open' | 'board'
path: text('path'),                               // used for cursor/open types; board type reuses url field for boardId
```

Add to `edges` table:
```typescript
edgeType: text('edge_type').notNull().default('default'), // 'default' (arrow) | 'plain' (no arrow)
```

#### 1.4 Update TypeScript Types

**File:** `src/types.ts`

Update `ReferenceLink`:
```typescript
export interface ReferenceLink {
  id: string
  nodeId: string
  name: string
  url: string
  type: 'url' | 'cursor' | 'open' | 'board'   // NEW
  path: string | null                            // NEW — for cursor/open; board type uses url for boardId
  createdAt: string
}
```

Update `Edge`:
```typescript
export interface Edge {
  id: string
  boardId: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
  targetHandle: string | null
  label: string | null
  edgeType: string   // NEW — 'default' | 'plain'
}
```

#### 1.5 Update Reference Link API Route

**File:** `server/src/app/api/nodes/[id]/references/route.ts`

Update POST handler to accept optional `type` and `path`:
```typescript
const { name, url, type, path } = await request.json()
// ... validation ...
const [ref] = await db
  .insert(referenceLinks)
  .values({ nodeId: id, name, url, type: type ?? 'url', path: path ?? null })
  .returning()
```

#### 1.6 Update Edge API Routes

**File:** `server/src/app/api/edges/route.ts`

Accept `edgeType` in POST:
```typescript
const { boardId, sourceNodeId, targetNodeId, sourceHandle, targetHandle, label, edgeType } = await request.json()
// Add edgeType: edgeType ?? 'default' to .values()
```

**File:** `server/src/app/api/edges/[id]/route.ts`

Add PATCH handler:
```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { edgeType } = await request.json()

  const [edge] = await db
    .update(edges)
    .set({ edgeType })
    .where(eq(edges.id, id))
    .returning()

  if (!edge) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(edge)
}
```

#### 1.7 Update API Client

**File:** `src/lib/api.ts`

Add `updateEdge` method, update `createReferenceLink` signature:
```typescript
createReferenceLink: (nodeId: string, data: { name: string; url: string; type?: string; path?: string }) =>
  request(`/api/nodes/${nodeId}/references`, { method: 'POST', body: JSON.stringify(data) }),

updateEdge: (id: string, data: { edgeType: string }) =>
  request(`/api/edges/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
```

---

### Phase 2: Better Nodes (UI)

#### 2.1 Install react-markdown

```bash
npm install react-markdown
```

#### 2.2 Update AtreidesNode Component

**File:** `src/components/AtreidesNode.tsx`

Changes:
- Import `ReactMarkdown` from `react-markdown`
- Increase max-width: `max-w-[240px]` → `max-w-[480px]`
- Replace description div: remove `line-clamp-2`, add `whitespace-pre-wrap`
- Render description through `<ReactMarkdown>` with appropriate prose classes
- Update reference link rendering to handle action types (cursor, open, board) — show appropriate icon/label and use onClick instead of href for non-url types

```tsx
import ReactMarkdown from 'react-markdown'

// In the description section, replace:
//   <div className="mt-1 text-[11px] text-ctp-subtext0 leading-[1.4] line-clamp-2">{data.description}</div>
// With:
<div className="mt-1 text-[11px] text-ctp-subtext0 leading-[1.4]">
  <ReactMarkdown
    components={{
      p: ({ children }) => <p className="m-0 mb-1 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-semibold text-ctp-text">{children}</strong>,
      em: ({ children }) => <em>{children}</em>,
      code: ({ children }) => <code className="bg-ctp-mantle px-1 rounded text-[10px]">{children}</code>,
      ul: ({ children }) => <ul className="m-0 pl-3 list-disc">{children}</ul>,
      ol: ({ children }) => <ol className="m-0 pl-3 list-decimal">{children}</ol>,
      li: ({ children }) => <li className="m-0">{children}</li>,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-ctp-blue hover:underline" onClick={e => e.stopPropagation()}>
          {children}
        </a>
      ),
    }}
  >
    {data.description}
  </ReactMarkdown>
</div>
```

For reference links, add type-aware rendering. URL-type links stay as `<a>` tags. Cursor/open/board types use `<button>` or `<span>` with an onClick handler:
```tsx
{data.referenceLinks.map(ref => {
  if (ref.type === 'url') {
    return (
      <a key={ref.id} href={ref.url} onClick={handleRefClick} target="_blank" rel="noopener noreferrer" ...>
        {ref.name}
      </a>
    )
  }
  return (
    <button key={ref.id} onClick={(e) => { e.stopPropagation(); data.onRefLinkClick?.(ref) }} ...>
      {ref.name}
    </button>
  )
})}
```

#### 2.3 Update NodeEditor — Wider Sidebar & Taller Textarea

**File:** `src/components/NodeEditor.tsx`

Changes:
- Sidebar width: `w-80` → `w-[480px]`
- Description textarea rows: `rows={3}` → `rows={9}`
- The sidebar already has `overflow-y-auto flex-1` on the content area, so scrolling already works

#### 2.4 Update NodeEditor — Reference Link Type Selector

**File:** `src/components/NodeEditor.tsx`

Add type state and type-specific value input for reference links:
```tsx
const [refType, setRefType] = useState<ChildLinkType>('url')
const [refValue, setRefValue] = useState('')  // replaces refUrl

// In the reference link add section, replace the URL input with:
<select value={refType} onChange={e => { setRefType(e.target.value as ChildLinkType); setRefValue('') }} className={fieldInputClass}>
  <option value="url">URL</option>
  <option value="cursor">Cursor</option>
  <option value="open">Open</option>
  <option value="board">Board</option>
</select>

// Then show the appropriate input based on type:
// - url: plain URL input
// - cursor/open: path input
// - board: BoardAutocomplete component
```

Update `handleAddRef` to pass type and resolve url/path correctly:
```typescript
const handleAddRef = async () => {
  if (!refName.trim() || !refValue.trim()) return
  setAddingRef(true)
  const data: { name: string; url: string; type: string; path?: string } = {
    name: refName.trim(),
    url: refType === 'url' ? refValue.trim() : (refType === 'board' ? refValue.trim() : ''),
    type: refType,
    path: (refType === 'cursor' || refType === 'open') ? refValue.trim() : undefined,
  }
  await api.createReferenceLink(nodeId, data)
  // reset state...
}
```

Also display existing reference links with their type badge so it's clear what type each one is.

---

### Phase 3: Edge Direction & Deleting

#### 3.1 Update useBoard — Edge Type Mapping

**File:** `src/hooks/useBoard.ts`

Update `toFlowEdges` to include `type` and `markerEnd` based on `edgeType`:
```typescript
import { MarkerType } from '@xyflow/react'

function toFlowEdges(data: BoardData): Edge[] {
  return data.edges.map(e => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label: e.label ?? undefined,
    // Arrow for 'default', no marker for 'plain'
    ...(e.edgeType !== 'plain' ? {
      markerEnd: { type: MarkerType.ArrowClosed, color: '#a6adc8' },
    } : {}),
    data: { dbEdgeType: e.edgeType },
  }))
}
```

#### 3.2 Create Edge Context Menu

**File:** `src/components/EdgeContextMenu.tsx`

A floating div positioned at click coordinates with two buttons:
- Toggle direction (arrow ↔ connector)
- Delete edge

```tsx
interface EdgeContextMenuProps {
  edgeId: string
  edgeType: string  // 'default' | 'plain'
  position: { x: number; y: number }
  onToggleType: (edgeId: string, newType: string) => void
  onDelete: (edgeId: string) => void
  onClose: () => void
}

export default function EdgeContextMenu({ edgeId, edgeType, position, onToggleType, onDelete, onClose }: EdgeContextMenuProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />
      {/* Menu */}
      <div
        className="fixed z-40 bg-ctp-surface0 border border-ctp-overlay0 rounded-lg shadow-lg py-1 min-w-[160px]"
        style={{ left: position.x, top: position.y }}
      >
        <button
          className="w-full px-3 py-2 text-left text-sm text-ctp-text hover:bg-ctp-surface1 flex items-center gap-2"
          onClick={() => onToggleType(edgeId, edgeType === 'default' ? 'plain' : 'default')}
        >
          {edgeType === 'default' ? '⟷ Make Connector' : '→ Make Arrow'}
        </button>
        <button
          className="w-full px-3 py-2 text-left text-sm text-ctp-red hover:bg-ctp-surface1 flex items-center gap-2"
          onClick={() => onDelete(edgeId)}
        >
          Delete Edge
        </button>
      </div>
    </>
  )
}
```

#### 3.3 Wire Up Edge Interactions in BoardCanvas

**File:** `src/components/BoardCanvas.tsx`

Add state and handlers for the edge context menu:

```typescript
const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; edgeType: string; position: { x: number; y: number } } | null>(null)

// Edge click handler — show context menu
const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
  setEdgeMenu({
    edgeId: edge.id,
    edgeType: (edge.data as any)?.dbEdgeType ?? 'default',
    position: { x: _event.clientX, y: _event.clientY },
  })
}, [])

// Toggle edge type
const handleToggleEdgeType = useCallback(async (edgeId: string, newType: string) => {
  await api.updateEdge(edgeId, { edgeType: newType })
  reload()
  setEdgeMenu(null)
}, [reload])

// Delete edge (persisted)
const handleDeleteEdge = useCallback(async (edgeId: string) => {
  await api.deleteEdge(edgeId)
  setEdges(eds => eds.filter(e => e.id !== edgeId))
  setEdgeMenu(null)
}, [setEdges])
```

Add `onEdgeClick={onEdgeClick}` to the `<ReactFlow>` component props.

Render the context menu:
```tsx
{edgeMenu && (
  <EdgeContextMenu
    edgeId={edgeMenu.edgeId}
    edgeType={edgeMenu.edgeType}
    position={edgeMenu.position}
    onToggleType={handleToggleEdgeType}
    onDelete={handleDeleteEdge}
    onClose={() => setEdgeMenu(null)}
  />
)}
```

#### 3.4 Handle Reference Link Actions

**File:** `src/components/AtreidesNode.tsx` and `src/types.ts`

Add `onRefLinkClick` callback to `AtreidesNodeData`:
```typescript
// In AtreidesNodeData:
onRefLinkClick?: (ref: ReferenceLink) => void
```

**File:** `src/hooks/useNodeActions.ts`

The existing `executeAction` takes a `ChildLink`. Reference links need the same execution. Add a helper that converts a ReferenceLink to a ChildLink-compatible action:
```typescript
function refLinkToAction(ref: ReferenceLink): ChildLink | null {
  switch (ref.type) {
    case 'url': return { type: 'url', value: ref.url }
    case 'cursor': return { type: 'cursor', path: ref.path! }
    case 'open': return { type: 'open', path: ref.path! }
    case 'board': return { type: 'board', boardId: ref.url }
    default: return null
  }
}
```

**File:** `src/components/BoardCanvas.tsx`

Inject `onRefLinkClick` into node data (similar to how `onChildLinkClick` is injected):
```typescript
const enriched = flowNodes.map(node => ({
  ...node,
  data: {
    ...node.data,
    onChildLinkClick: () => handleChildLinkClick(node.data as AtreidesNodeData),
    onRefLinkClick: (ref: ReferenceLink) => {
      const action = refLinkToAction(ref)
      if (action) {
        if (action.type === 'board') pushBoard(action.boardId, ref.name)
        else executeAction(action)
      }
    },
  },
}))
```

---

### Phase Summary

| Phase | Scope | Files Changed |
|-------|-------|---------------|
| 1 | Database & API | schema, migrations, API routes, api client, types |
| 2 | Better Nodes UI | AtreidesNode, NodeEditor, package.json (react-markdown) |
| 3 | Edge Direction & Deleting | useBoard, BoardCanvas, EdgeContextMenu (new) |

Phases 1→2→3 must be done in order since Phase 2 and 3 depend on Phase 1's type changes.
