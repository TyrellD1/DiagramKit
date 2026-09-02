## Overview

**Product:** A graph-based spatial organizer for companies, individuals, and students.

**Stack:**

- **Backend:** Next.js (serverless)
- **Frontend:** Electron (monorepo — runs in browser as well, minus local-only tools like `open .` or `cursor .`)
- **Database:** Neon (from the start)
- **Auth:** Better Auth (chosen because Next.js + Neon)
- **Graph UI:** React Flow — https://reactflow.dev/

---

## Core Concepts

### Nodes

A node is the fundamental unit. Every item on a board is a node.

Nodes represent things like:

- Areas of business (e.g. Marketing, Sales, Product, Support, Legal)
- Production lines (e.g. "LinkedIn post generation" within Marketing)
- Storefronts (e.g. a landing page within Sales)
- Files, memories, or context (e.g. where LinkedIn posts live, or actual LinkedIn posts)

**These are just examples.** The system is ultimately open-ended. There may be baked-in ontologies or the ability to create custom ones, but what a node represents is up to the user.

**Every node has the following default fields (not infinitely customizable like Figma):**

- `title` — string
- `description` — string
- `onClick` — an action, e.g. run a CLI command, open an IDE command, open a link, etc.

### Boards

A board is a spatial canvas of nodes.

**Key rules:**

- Boards are **not** fundamentally hierarchical
- A node **can link to** a board (or a specific point on a board), which *creates the appearance* of hierarchy
- Every board should have a **parent node** (to encourage spatial organization). For example: the "Marketing" board is a child of a node on the "Chair" board, which contains high-level business nodes
- Every board also has a **parent board** (the board its parent node lives on)

---

## High Level Goals

- [ ]  Boards are not fundamentally hierarchical — nodes can link to boards (and points on boards) which makes it *seem* hierarchical
- [ ]  
- [ ]  
- [ ]  

---

## Future Ideas (NOT in scope now)

<aside>
🚫

**Do not implement these.** Listed here only for long-term context.

</aside>

- Users could define what spatial properties mean (e.g. distance from center = time since posted, edge color = success metric)
- Boards could be programmatically configured based on ontologies (e.g. "show all LinkedIn posts; distance from center = post date; edge color = engagement score; auto-pull from directory or database")

---

## Optional Recommendations

<aside>
💡

**These are suggestions from Lleryt** — not part of the original plan. Implement only if Tyrell approves.

</aside>

- **Node `type` field:** Add an optional `type` enum (e.g. `area`, `production_line`, `storefront`, `file`, `custom`) to nodes. This would make it easier to filter, style, and query nodes without relying solely on spatial position. Does not limit what a node can represent — just gives optional semantic tagging.
- **Board metadata:** Consider a `description` and `icon` field on boards themselves (not just nodes), so boards are self-documenting when browsing a list or search.
- **Node `tags` field:** A lightweight array of strings on each node for ad-hoc categorization. Cheaper than full ontologies but useful for filtering and search.
- **`onClick` action schema:** Define a small set of action types early (e.g. `{ type: "url", value: "https://..." }`, `{ type: "cli", value: "open ." }`, `{ type: "board", boardId: "..." }`). This avoids ambiguity when the LLM generates the onClick handler and makes it extensible later.
- **Soft-delete / archive for nodes and boards:** Useful for spatial tools where accidental deletion is painful. A simple `archived: boolean` flag is enough.
- **Zoom-to-board transition:** When a node links to a board, animate a zoom-in transition to that board. This reinforces the spatial hierarchy metaphor and is a natural UX for React Flow.

## Database Schema (Neon / Postgres)

> Better Auth owns the `user` and `session` tables — not shown here.
> 

### `boards`

| **Column** | **Type** | **Constraints** | **Notes** |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |  |
| `owner_id` | uuid | FK → [`user.id`](http://user.id), NOT NULL | Who owns this board |
| `parent_node_id` | uuid | FK → [`nodes.id`](http://nodes.id), NULLABLE | The node this board "lives inside." NULL only for the root board |
| `title` | text | NOT NULL |  |
| `description` | text | NULLABLE | *Optional rec* |
| `icon` | text | NULLABLE | *Optional rec* — emoji or icon key |
| `archived` | boolean | NOT NULL, default `false` | *Optional rec* — soft delete |
| `created_at` | timestamptz | NOT NULL, default `now()` |  |
| `updated_at` | timestamptz | NOT NULL, default `now()` |  |

### `nodes`

| **Column** | **Type** | **Constraints** | **Notes** |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |  |
| `board_id` | uuid | FK → [`boards.id`](http://boards.id), NOT NULL | The board this node lives on |
| `title` | text | NOT NULL |  |
| `description` | text | NULLABLE |  |
| `position_x` | float | NOT NULL | React Flow x coordinate |
| `position_y` | float | NOT NULL | React Flow y coordinate |
| `on_click` | jsonb | NULLABLE | Action payload — see **onClick schema** below |
| `type` | text | NULLABLE | *Optional rec* — e.g. `area`, `production_line`, `storefront`, `file`, `custom` |
| `tags` | text[] | NULLABLE | *Optional rec* — freeform string array |
| `archived` | boolean | NOT NULL, default `false` | *Optional rec* — soft delete |
| `created_at` | timestamptz | NOT NULL, default `now()` |  |
| `updated_at` | timestamptz | NOT NULL, default `now()` |  |

### `node_links`

This is how nodes "link to" boards (or specific points on boards), creating the *perceived* hierarchy.

| **Column** | **Type** | **Constraints** | **Notes** |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |  |
| `source_node_id` | uuid | FK → [`nodes.id`](http://nodes.id), NOT NULL, UNIQUE | The node that acts as the "portal" |
| `target_board_id` | uuid | FK → [`boards.id`](http://boards.id), NOT NULL | The board it links to |
| `target_x` | float | NULLABLE | Optional point on target board to zoom to |
| `target_y` | float | NULLABLE | Optional point on target board to zoom to |
| `created_at` | timestamptz | NOT NULL, default `now()` |  |

### `edges`

Connections between nodes **on the same board** (React Flow edges).

| **Column** | **Type** | **Constraints** | **Notes** |
| --- | --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |  |
| `board_id` | uuid | FK → [`boards.id`](http://boards.id), NOT NULL | Both nodes must be on this board |
| `source_node_id` | uuid | FK → [`nodes.id`](http://nodes.id), NOT NULL |  |
| `target_node_id` | uuid | FK → [`nodes.id`](http://nodes.id), NOT NULL |  |
| `label` | text | NULLABLE | Optional edge label |
| `created_at` | timestamptz | NOT NULL, default `now()` |  |

### onClick Action Schema (jsonb)

*Optional rec* — Typed action payloads stored in `nodes.on_click`:

```json
// Open a URL
{ "type": "url", "value": "https://example.com" }

// Run a CLI command (Electron only)
{ "type": "cli", "value": "cursor ." }

// Navigate to a board (equivalent to a node_link — for inline use)
{ "type": "board", "boardId": "uuid" }
```

### Key Relationships

- A **board** has many **nodes** (`nodes.board_id → [boards.id](http://boards.id)`)
- A **node** can optionally link to one **board** via `node_links` — this is what creates perceived hierarchy
- A **board** has exactly one **parent node** (`boards.parent_node_id → [nodes.id](http://nodes.id)`), except the root board
- **Edges** connect two nodes on the same board
- Hierarchy is **emergent**: board → parent node → that node's board → *that* board's parent node → and so on up to root