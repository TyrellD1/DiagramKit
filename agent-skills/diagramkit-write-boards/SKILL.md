---
name: diagramkit-write-boards
description: How to create and update DiagramKit boards and switch workspaces via the HTTP API or JSON files. Use when adding boards, nodes, or edges, attaching a workspace directory, migrating data, or when the user asks to create/update DiagramKit content.
---

# Create and update DiagramKit boards

Prefer the CLI to create, open, and validate workspaces (`agent-skills/diagramkit-cli`). Prefer the HTTP API for board reads/writes while the app is running. Direct file writes are fine for bulk edits; keep JSON valid and write atomically.

**Agents:** do not write boards in `~/.diagramkit` or `~/diagram-kit`. Attach `~/.diagram-kit-local1` (and `local2` if needed) first. See `AGENTS.md`.

## Workspaces

```sh
diagramkit create ~/.diagram-kit-local1
diagramkit open ~/.diagram-kit-local1 --no-browser
diagramkit validate ~/.diagram-kit-local1
diagramkit workspaces
```

`open` attaches and switches. `create` only scaffolds. Do not write boards into `~/.diagramkit`.

HTTP equivalent if the CLI is unavailable:

| Method | Path | Body | Notes |
|--------|------|------|--------|
| GET | `/health` | | `{ ok, workspace }` |
| GET | `/workspaces` | | `{ homeDir, appDir, activePath, workspaces[] }` |
| POST | `/workspaces/attach` | `{ path, name? }` | Resolves `~`. Creates the dir and seeds Home if empty. Sets it active. |
| POST | `/workspaces/switch` | `{ id }` or `{ path }` | Changes which dir `/boards` reads |
| DELETE | `/workspaces/:id` | | Detach only. Does not delete files. Cannot detach default. |

Attach is a pointer. It does not copy the default workspace.

## Boards (active workspace only)

Base: `http://127.0.0.1:3001/api` (or `/api` from the Vite origin).

| Method | Path | Body | Notes |
|--------|------|------|--------|
| GET | `/boards` | | `{ rootBoardId, boards: [{ id, title, parentId }] }` |
| POST | `/boards` | `{ title }` | Creates empty board file + index row |
| GET | `/boards/:id` | | Full `BoardDocument` |
| PUT | `/boards/:id` | Full `BoardDocument` | `body.id` must match URL. Replaces the file |
| DELETE | `/boards/:id` | | Cannot delete the root board |

There are no row-level node/edge endpoints. Load the board, mutate `nodes`/`edges` in memory, PUT the whole document.

## Create a nested child board

1. `POST /api/boards` with `{ "title": "Projects" }` → `{ id, ... }`
2. GET the parent board
3. On the chosen node, set `enterBoardId` to the new id (keep `childLink` for the arrow action if needed)
4. PUT the parent board

Do not also set `childLink: { type: "board" }` for nesting. That is a jump, not tree membership.

## Create a node

Append to `nodes`:

```json
{
  "id": "<uuid>",
  "title": "Inbox",
  "description": null,
  "x": 120,
  "y": 80,
  "enterBoardId": null,
  "childLink": null,
  "refs": []
}
```

## Create an edge

Append to `edges`:

```json
{
  "id": "<uuid>",
  "source": "<node-id>",
  "target": "<node-id>",
  "sourceHandle": "right",
  "targetHandle": "left",
  "edgeType": "default"
}
```

## File writes

Active workspace: `$activePath/index.json` and `$activePath/boards/<id>.json`.
Registry: `~/.diagramkit/workspaces.json`.

1. Read existing JSON
2. Write `<file>.<uuid>.tmp` with pretty JSON plus a trailing newline
3. `rename` onto the target
4. Keep `index.boards` in sync with board files and titles
5. After creating a board file, add `{ id, title }` to `index.boards`

Do not add a database. Do not invent `parentId` on disk.
