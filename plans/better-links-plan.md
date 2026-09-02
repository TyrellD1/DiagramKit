# Better Links - Implementation Plan

## Overview

Rework the link system so each node supports two distinct link concepts:

1. **Child link** (max one per node) -- a "primary action" triggered by a button in the top-right corner of the node. Can be: `cursor <path>`, `open <path>`, `url`, or a board link (`/<board-id>`).
2. **Reference links** (zero or more per node) -- secondary links displayed at the bottom of the node. Each has a name + target.

All link buttons must `stopPropagation` so clicking them doesn't trigger node selection or other node-level handlers.

## High Level Goals

- Replace the current `OnClickAction` / `onClick` field with a single child link model
- Introduce reference links (many per node) as a separate concept
- Hardcode link types to `cursor`, `open`, `url`, and `board` (no arbitrary CLI)
- Build the type/schema in an expandable way so new link types can be added later
- Child link: button in top-right corner of node
- Reference links: listed at the bottom of the node if any exist
- All link buttons prevent event propagation

---

## File paths

- `src/types.ts` - Replace `OnClickAction` with `ChildLink` and `ReferenceLink` union types. Update `AtreidesNodeData` to carry child link + reference links instead of `onClick`.
- `server/src/db/schema.ts` - Add `referenceLinks` table. Remove `onClick` jsonb column from `nodes`, add `childLink` jsonb column.
- `server/src/app/api/nodes/[id]/route.ts` - Update `ALLOWED_FIELDS` to include `childLink` instead of `onClick`.
- `server/src/app/api/nodes/[id]/references/route.ts` (new) - CRUD endpoints for reference links on a node.
- `src/lib/api.ts` - Add reference link API methods. Rename `onClick` usage to `childLink`.
- `src/hooks/useBoard.ts` - Update `toFlowNodes` to pass `childLink` and `referenceLinks` into node data.
- `src/hooks/useNodeActions.ts` - Replace `OnClickAction` handler with `ChildLink` executor supporting `cursor`, `open`, `url`, `board` types.
- `src/components/AtreidesNode.tsx` - Add child link button (top-right), render reference links list (bottom). Wire `stopPropagation` on all link buttons.
- `src/components/NodeEditor.tsx` - Replace `onClick` editor with child link editor (type selector for `cursor`/`open`/`url`/`board`). Add reference links section (add/remove).
- `src/App.css` - Styles for child link button, reference link list, reference link items.

## Manual testing plan

1. Start the dev server with `bun run dev` (frontend) and `cd server && bun run dev` (backend)
2. Log in and navigate to a board with existing nodes
3. **Child link - URL:** Edit a node, set child link type to "URL", enter a valid URL, save. Verify the node shows a link button in the top-right corner. Click the button -- it should open the URL in a browser. Verify clicking the button does NOT select/deselect the node.
4. **Child link - Open:** Edit a node, set child link type to "Open", enter a file path, save. Click the link button -- in Electron it should run `open <path>`, in browser it should warn or no-op.
5. **Child link - Cursor:** Same as above but with "Cursor" type. Should invoke `cursor <path>` via Electron IPC.
6. **Child link - Board:** Edit a node, set child link type to "Board", enter a board ID. Click the link button -- should navigate to that board.
7. **Child link removal:** Edit a node with a child link, set type to "None", save. Verify the button disappears from the node.
8. **Reference links - Add:** In the node editor, add a reference link with a name and URL. Save. Verify it appears at the bottom of the node card.
9. **Reference links - Multiple:** Add 2-3 reference links. Verify they all render. Click each one -- should open/execute correctly. Verify clicks don't propagate.
10. **Reference links - Remove:** Delete a reference link in the editor. Save. Verify it disappears from the node.
11. **Migration:** Verify that existing nodes with `onClick` data are handled gracefully (either migrated or displayed correctly).

---

## Implementation Plan

### Architecture Decision: Child link storage

**Option A: Keep `childLink` as a JSONB column on the `nodes` table**
- Pros: Simple, one fewer join, matches existing `onClick` pattern
- Cons: Not normalized

**Option B: Separate `child_links` table**
- Pros: Normalized, referential integrity
- Cons: Extra join, extra table for a 1:1 relationship

**Recommendation: Option A** -- A JSONB column is the right call for a 1:1 relationship where the data is a simple discriminated union. This matches the existing pattern and avoids unnecessary complexity. The existing `nodeLinks` table can remain for board portal navigation (it stores viewport position info), or we can consolidate later.

### Architecture Decision: Relationship between `childLink` and `nodeLinks`

The current system has two overlapping concepts:
- `onClick` on the node (url/cli/board action)
- `nodeLinks` table (node-to-board portal with viewport targeting)

The ticket wants a single "child link" concept. I recommend:
- **Keep `nodeLinks` for board-type child links** -- it has useful metadata (targetX, targetY) and cascading deletes
- **Use the `childLink` JSONB column for non-board child links** (cursor, open, url)
- When rendering, prefer `nodeLink` if it exists, otherwise use `childLink`
- This avoids a migration nightmare and keeps the portal navigation working

### Architecture Decision: CLI command sanitization

The ticket says "options should be hardcoded, not generic CLI commands" and to support `cursor` and `open` only. This means:

- **Remove** the generic `cli` type entirely
- **Add** `cursor` and `open` as first-class link types that construct their own commands internally
- The user provides only a path, never an arbitrary command
- The IPC handler constructs the full command: `cursor <path>` or `open <path>`

This is a meaningful security improvement.

---

### Phase 1: Types and Schema

#### 1.1 Update types

**File:** `src/types.ts`

```typescript
// Link types (child link on a node)
export type ChildLinkType = 'url' | 'cursor' | 'open' | 'board'

export type ChildLink =
  | { type: 'url'; value: string }
  | { type: 'cursor'; path: string }
  | { type: 'open'; path: string }
  | { type: 'board'; boardId: string }

// Reference link (many per node)
export interface ReferenceLink {
  id: string
  nodeId: string
  name: string
  url: string
  createdAt: string
}

// Update AtreidesNode -- replace onClick with childLink
export interface AtreidesNode {
  id: string
  boardId: string
  title: string
  description: string | null
  positionX: number
  positionY: number
  childLink: ChildLink | null  // replaces onClick
  type: string | null
  tags: string[] | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

// Update AtreidesNodeData for React Flow
export interface AtreidesNodeData {
  title: string
  description: string | null
  childLink: ChildLink | null      // replaces onClick
  referenceLinks: ReferenceLink[]   // new
  hasLink: boolean
  linkedBoardId: string | null
  dbId: string
  [key: string]: unknown
}
```

Remove the old `OnClickAction` type. Keep `NodeLink`, `Board`, `Edge`, `BoardData` as-is. Update `BoardData` to include `referenceLinks`:

```typescript
export interface BoardData {
  board: Board
  nodes: AtreidesNode[]
  edges: Edge[]
  nodeLinks: NodeLink[]
  referenceLinks: ReferenceLink[]  // new
}
```

#### 1.2 Update database schema

**File:** `server/src/db/schema.ts`

Rename `onClick` column to `childLink` on the `nodes` table:

```typescript
// In the nodes table definition, replace:
//   onClick: jsonb('on_click'),
// with:
  childLink: jsonb('child_link'),
```

Add the `referenceLinks` table:

```typescript
export const referenceLinks = pgTable('reference_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Note:** This requires a database migration. The migration should:
1. Rename `on_click` column to `child_link`
2. Transform existing `{"type":"cli","value":"..."}` entries -- either drop them or convert to `open` type
3. Transform existing `{"type":"url","value":"..."}` entries -- these remain valid
4. Create the `reference_links` table

---

### Phase 2: Server API

#### 2.1 Update node PATCH endpoint

**File:** `server/src/app/api/nodes/[id]/route.ts`

Update `ALLOWED_FIELDS` to use `childLink` instead of `onClick`:

```typescript
const ALLOWED_FIELDS = ['title', 'description', 'positionX', 'positionY', 'childLink'] as const
```

#### 2.2 Add reference links CRUD

**File:** `server/src/app/api/nodes/[id]/references/route.ts` (new)

```typescript
// GET /api/nodes/:id/references -- list reference links for a node
// POST /api/nodes/:id/references -- create a reference link { name, url }
```

**File:** `server/src/app/api/references/[id]/route.ts` (new)

```typescript
// DELETE /api/references/:id -- delete a reference link
```

#### 2.3 Update board GET to include reference links

**File:** `server/src/app/api/boards/[id]/route.ts`

When fetching a board, also fetch all reference links for nodes in that board and include them in the response:

```typescript
// After fetching nodes, get reference links for all node IDs
const refs = await db
  .select()
  .from(referenceLinks)
  .where(inArray(referenceLinks.nodeId, nodeIds))

return { board, nodes, edges, nodeLinks, referenceLinks: refs }
```

---

### Phase 3: Client updates

#### 3.1 Update API client

**File:** `src/lib/api.ts`

```typescript
// Add to api object:
createReferenceLink: (nodeId: string, data: { name: string; url: string }) =>
  request(`/api/nodes/${nodeId}/references`, { method: 'POST', body: JSON.stringify(data) }),
deleteReferenceLink: (id: string) =>
  request(`/api/references/${id}`, { method: 'DELETE' }),
```

Update `updateNode` to use `childLink` instead of `onClick` in the type signature.

#### 3.2 Update useBoard hook

**File:** `src/hooks/useBoard.ts`

Update `toFlowNodes` to include `childLink` and `referenceLinks` in node data:

```typescript
function toFlowNodes(data: BoardData): Node<AtreidesNodeData>[] {
  const linkMap = new Map(data.nodeLinks.map(l => [l.sourceNodeId, l]))
  const refMap = new Map<string, ReferenceLink[]>()
  for (const ref of data.referenceLinks) {
    const list = refMap.get(ref.nodeId) ?? []
    list.push(ref)
    refMap.set(ref.nodeId, list)
  }

  return data.nodes
    .filter(n => !n.archived)
    .map(n => {
      const link = linkMap.get(n.id)
      return {
        id: n.id,
        type: 'atreides',
        position: { x: n.positionX, y: n.positionY },
        data: {
          title: n.title,
          description: n.description,
          childLink: n.childLink,
          referenceLinks: refMap.get(n.id) ?? [],
          hasLink: !!link || !!n.childLink,
          linkedBoardId: link?.targetBoardId ?? null,
          dbId: n.id,
        },
      }
    })
}
```

#### 3.3 Update useNodeActions hook

**File:** `src/hooks/useNodeActions.ts`

Replace `OnClickAction` handling with `ChildLink`:

```typescript
import type { ChildLink } from '@/types'

export function useNodeActions({ pushBoard }: Options) {
  const executeAction = useCallback((link: ChildLink) => {
    switch (link.type) {
      case 'url':
        if (isElectron) {
          window.ipcRenderer.invoke('open-external', link.value)
        } else {
          window.open(link.value, '_blank')
        }
        break

      case 'cursor':
        if (isElectron) {
          window.ipcRenderer.invoke('run-cli', `cursor ${link.path}`)
        } else {
          console.warn('Cursor actions are only available in the desktop app')
        }
        break

      case 'open':
        if (isElectron) {
          window.ipcRenderer.invoke('run-cli', `open ${link.path}`)
        } else {
          console.warn('Open actions are only available in the desktop app')
        }
        break

      case 'board':
        pushBoard(link.boardId)
        break
    }
  }, [pushBoard])

  return { executeAction }
}
```

---

### Phase 4: UI Components

#### 4.1 Update AtreidesNode component

**File:** `src/components/AtreidesNode.tsx`

Add the child link button in the top-right corner and reference links at the bottom:

```tsx
function AtreidesNode({ data, selected }: NodeProps<AtreidesNodeType>) {
  const handleChildLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Execution is handled by BoardCanvas (via a callback in data or a global handler)
  }

  return (
    <div className={`atreides-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} />

      <div className="atreides-node__header">
        <span className="atreides-node__title">{data.title}</span>
        {(data.hasLink || data.childLink) && (
          <button
            className="atreides-node__child-link-btn"
            onClick={handleChildLinkClick}
            title={getChildLinkLabel(data)}
          >
            ↗
          </button>
        )}
      </div>

      {data.description && (
        <div className="atreides-node__description">{data.description}</div>
      )}

      {data.referenceLinks.length > 0 && (
        <div className="atreides-node__references">
          {data.referenceLinks.map(ref => (
            <a
              key={ref.id}
              className="atreides-node__ref-link"
              href={ref.url}
              onClick={(e) => e.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ref.name}
            </a>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
```

**Design decision for child link click execution:** Since React Flow nodes are memoized and don't receive callbacks easily, we need to decide how the child link button triggers the action. Options:

- **A: Pass `executeAction` through node data** -- simple, works, slightly impure
- **B: Custom event** -- dispatch a custom DOM event, listen in BoardCanvas
- **C: Use React Flow's built-in node event system** -- cleanest

**Recommendation: Option A** -- pass `onChildLinkClick` as a function in the node data. React Flow supports this; the memo comparison handles it fine since it's a stable callback ref.

#### 4.2 Update NodeEditor

**File:** `src/components/NodeEditor.tsx`

Replace the `onClick` action editor with a child link editor:

- Type selector: None / URL / Cursor / Open / Board
- Value input with appropriate placeholder per type
- Reference links section at the bottom:
  - List existing reference links with delete buttons
  - "Add Reference Link" form (name + url inputs)

#### 4.3 Update BoardCanvas

**File:** `src/components/BoardCanvas.tsx`

- Update `onNodeDoubleClick` to use `childLink` instead of `onClick`
- Pass `onChildLinkClick` callback through node data so the button in AtreidesNode can trigger actions
- Update `toFlowNodes` call in `useBoard` to include the callback

---

### Phase 5: Styles

**File:** `src/App.css`

```css
/* Child link button */
.atreides-node__child-link-btn {
  flex-shrink: 0;
  background: none;
  border: 1px solid #313244;
  border-radius: 4px;
  color: #89b4fa;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  line-height: 1;
  transition: background 0.15s, border-color 0.15s;
}

.atreides-node__child-link-btn:hover {
  background: rgba(137, 180, 250, 0.15);
  border-color: #89b4fa;
}

/* Reference links */
.atreides-node__references {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #313244;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.atreides-node__ref-link {
  font-size: 11px;
  color: #89b4fa;
  text-decoration: none;
  cursor: pointer;
  padding: 1px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atreides-node__ref-link:hover {
  text-decoration: underline;
}
```

---

### Migration notes

The rename of `on_click` to `child_link` and data shape transformation requires a SQL migration. Draft:

```sql
-- Rename column
ALTER TABLE nodes RENAME COLUMN on_click TO child_link;

-- Transform cli actions to open actions
UPDATE nodes
SET child_link = jsonb_build_object('type', 'open', 'path', child_link->>'value')
WHERE child_link->>'type' = 'cli';

-- Create reference_links table
CREATE TABLE reference_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
