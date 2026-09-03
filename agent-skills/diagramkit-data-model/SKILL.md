---
name: diagramkit-data-model
description: Explains the DiagramKit JSON data model (boards, nodes, edges, workspaces, enterBoardId vs childLink). Use when reading or editing DiagramKit JSON, implementing board/node/edge/workspace features, or answering questions about how DiagramKit stores graphs.
---

# DiagramKit data model

Local, single-user. No database. One JSON file per board. A workspace is a directory of those files.

## App home vs workspace

App home (default `~/.diagramkit`, override `DIAGRAMKIT_HOME`):

```
~/.diagramkit/
  workspaces.json         # registry of attached workspace dirs + activePath
  index.json              # default workspace board index
  boards/<uuid>.json      # default workspace boards
```

An attached workspace is **some other directory** with the same `index.json` + `boards/` shape. Attaching does not copy boards. Switching `activePath` changes which directory the API reads and writes.

`workspaces.json`:

```ts
{
  activePath: string
  workspaces: Array<{
    id: string              // "default" for the built-in workspace
    path: string            // absolute
    name: string
    kind: "default" | "attached"
    attachedAt: string      // ISO
  }>
}
```

The default workspace cannot be detached. User boards in `~/.diagramkit/boards` (and `~/diagram-kit` if attached) are off limits unless the user explicitly asks. Agents test in `~/.diagram-kit-local1` / `~/.diagram-kit-local2`. See `AGENTS.md`.

Writes are atomic: temp file next to the target, then `rename`.

`parentId` is **not** stored. The sidebar tree is derived by scanning the active workspace's boards for `node.enterBoardId`.

## BoardDocument

```ts
{
  schemaVersion: number        // current is 2; missing means 0 (legacy)
  id: string
  title: string
  nodes: BoardNode[]
  edges: BoardEdge[]
}
```

Schema changes: add `migrations/NNN_slug.ts` and never edit a shipped file. See `AGENTS.md`.

## BoardNode

```ts
{
  id: string
  title: string
  description: string | null   // markdown, rendered on the card
  x: number
  y: number
  enterBoardId: string | null  // nested child board (tree membership)
  childLink: ChildLink | null  // primary action on the card arrow
  refs: ReferenceLink[]        // extra links listed on the card
  color: "default" | "red" | "yellow" | "blue"   // pastel fill; default is the surface
  borderStyle: "solid" | "dashed" | "none"       // default is solid
}
```

`ChildLink`:

- `{ type: "url", value }`
- `{ type: "cursor", path }`
- `{ type: "open", path }`
- `{ type: "board", boardId }`  // jump only; does **not** nest in the tree

`ReferenceLink`: `{ id, name, type, target }` where `type` is `url | cursor | open | board` and `target` is the URL, path, or board id.

## BoardEdge

```ts
{ id, source, target, sourceHandle, targetHandle, edgeType }
```

`edgeType`: `"default"` (arrow) or `"plain"` (no marker). Handles are `"top" | "left" | "bottom" | "right"` or `null`. Any side can connect to any side.

## Hierarchy rule

- **Nest / drill down:** set `enterBoardId` on the parent node to the child board id. UI: "Link to new board".
- **Jump:** `childLink.type === "board"` or a ref of type `board`. Same canvas navigation, not a parent/child edge in the tree.

Internal React Flow node type is still `'atreides'`. Ignore that name.

Do not add SQLite, Postgres, or a second source of truth.
