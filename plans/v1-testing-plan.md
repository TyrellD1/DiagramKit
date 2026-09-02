## Overview

Testing plan for Atreides v1 — focused on reliability over coverage metrics.

The goal isn't "get to 80% coverage." The goal is: **when I change code, broken things get caught before I notice them manually.** That means testing the seams where things actually break: API contract boundaries, data transformations, state transitions, and cascade behaviors.

### What we're NOT doing

- Component snapshot tests (brittle, low signal)
- Mocking React Flow internals (testing the framework, not our code)
- Testing CSS / visual rendering (that's manual QA or Playwright E2E)
- Exhaustive unit tests for simple pass-through components like `BoardBreadcrumbs` or `AtreidesNode`

### What we ARE doing

- **Server route tests** with a real test database — the actual queries, the actual auth, the actual HTTP responses
- **Hook tests** for business logic that transforms data or manages state
- **API client tests** to catch contract drift between frontend and backend
- **Cascade/integrity tests** to verify that deleting a board doesn't orphan nodes

## High Level Goals

- [ ] Server-side API route tests against a real Postgres test database (not mocks)
- [ ] Frontend hook tests for `useBoard`, `useAutoSave`, `useNodeActions`, `useBoardNavigation`
- [ ] API client contract tests ensuring `api.ts` stays in sync with server responses
- [ ] Data transformation tests for `toFlowNodes`/`toFlowEdges` in `useBoard.ts`
- [ ] Database cascade/integrity tests for delete propagation
- [ ] CLAUDE.md updates to encode testing practices into the development workflow

---

## File paths

### New files

- `server/vitest.config.ts` — Vitest config for server tests, pointed at test database
- `server/src/test/setup.ts` — Test database setup/teardown, test user creation helper
- `server/src/test/routes/boards.test.ts` — Board CRUD route tests
- `server/src/test/routes/nodes.test.ts` — Node CRUD + position update route tests
- `server/src/test/routes/edges.test.ts` — Edge CRUD route tests
- `server/src/test/routes/node-links.test.ts` — Portal link CRUD route tests
- `server/src/test/routes/cascades.test.ts` — Delete cascade / referential integrity tests
- `src/test/hooks/useBoard.test.ts` — Data transformation and reload behavior tests
- `src/test/hooks/useAutoSave.test.ts` — Debounce timing and batch save tests
- `src/test/hooks/useNodeActions.test.ts` — Action dispatch tests (URL, CLI, board)
- `src/test/lib/api.test.ts` — API client contract tests (mocked fetch, response shape assertions)
- `CLAUDE.md` — Project-level AI assistant instructions including testing practices

### Modified files

- `server/package.json` — Add `vitest` devDependency and `test` script
- `package.json` — Update vitest config to include `src/test/` and add `@testing-library/react` for hook tests
- `vitest.config.ts` — Add path aliases, update include patterns, configure jsdom environment
- `server/src/lib/db.ts` — Extract DB factory so tests can use a different connection string

---

## Manual testing plan

1. Run `cd server && npm test` — all server route tests pass
2. Run `npm test` (root) — all frontend hook tests and API contract tests pass
3. Deliberately break `server/src/app/api/boards/route.ts` (e.g., return wrong field name) — verify the API contract test catches it
4. Deliberately break `toFlowNodes` in `useBoard.ts` (e.g., swap x/y) — verify the data transformation test catches it
5. Delete a board via the test suite — verify nodes, edges, and nodeLinks are cascade-deleted
6. Run both test suites from CI (or `npm run test:all`) — verify everything passes in a clean run

---

## Implementation Plan

### Architecture Decision: How to test server routes

**Options:**

1. **Mock the database** — Fast, but tests don't catch real SQL issues. Drizzle query builder bugs, missing columns, type mismatches — all invisible.
2. **Real test database (separate Neon branch or local Postgres)** — Slower, but tests catch real issues. What actually breaks in production: queries that don't match the schema, cascade behaviors, constraint violations.
3. **In-memory SQLite** — Middle ground, but Drizzle's Postgres-specific features (JSONB, UUID, arrays) won't work.

**Recommendation: Option 2 — Real test database.** Use a dedicated Neon database branch (or a local Postgres via Docker for CI). The whole point is catching query issues before they hit production. Mocking Drizzle defeats the purpose. The test database gets wiped between test runs via a `beforeEach` that truncates all tables.

### Architecture Decision: How to test frontend hooks

**Options:**

1. **`@testing-library/react-hooks`** (deprecated) — outdated
2. **`@testing-library/react` with `renderHook`** — standard, well-supported
3. **Test the transformation functions directly** — skip the hook wrapper, test `toFlowNodes`/`toFlowEdges` as pure functions

**Recommendation: Option 3 for data transformations, Option 2 for stateful hooks.** `toFlowNodes` and `toFlowEdges` are pure functions — test them directly, no React rendering needed. For hooks like `useAutoSave` (timers, refs) and `useNodeActions` (side effects), use `renderHook` from `@testing-library/react`.

---

### Phase 1: Server test infrastructure

#### 1.1 Server Vitest config

**File:** `server/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    root: __dirname,
    include: ['src/test/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    setupFiles: ['src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

#### 1.2 Test database setup

**File:** `server/src/test/setup.ts`

This file handles:
- Connecting to a test database (`DATABASE_URL_TEST` env var, falling back to `DATABASE_URL`)
- A `resetDb()` helper that truncates all tables (boards, nodes, edges, node_links) between tests
- A `createTestUser()` helper that inserts a user into Better Auth's `user` table and returns a session cookie
- A `testRequest()` helper that calls the Next.js route handlers directly (no HTTP server needed)

The key design choice: **call route handler functions directly** rather than spinning up a Next.js server. This is faster and avoids port conflicts. We import the route handler (e.g., `GET` from `@/app/api/boards/route.ts`) and call it with a constructed `Request` object.

```typescript
// Pseudocode — actual implementation will handle Next.js route handler signatures
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/db/schema'
import { sql } from 'drizzle-orm'

const testSql = neon(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL!)
export const testDb = drizzle(testSql, { schema })

export async function resetDb() {
  // Truncate in dependency order (edges → nodeLinks → nodes → boards)
  // Then truncate auth tables (session → account → user)
  await testDb.execute(sql`TRUNCATE TABLE edges, node_links, nodes, boards, session, account, "user" CASCADE`)
}

export async function createTestUser(overrides?: { email?: string; name?: string }) {
  // Insert directly into Better Auth's user table
  // Return { userId, sessionCookie } for authenticated requests
}

export function buildRequest(method: string, url: string, body?: unknown, cookie?: string): Request {
  // Construct a Request object that matches what Next.js route handlers expect
}
```

**Notes:**
- `DATABASE_URL_TEST` should point to a separate Neon branch or a local Postgres instance. Never the production DB.
- `resetDb()` runs in `beforeEach` so tests are isolated.
- We do NOT test through the middleware (CORS, auth check). Route handlers are tested for their business logic. Middleware gets its own focused test if needed.

#### 1.3 Extract DB factory

**File:** `server/src/lib/db.ts` — modify to allow test override

The current `db.ts` creates the Drizzle instance directly. To let tests use a different connection, export a factory function and keep the default export for production:

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/db/schema'

export function createDb(connectionString: string) {
  const sql = neon(connectionString)
  return drizzle(sql, { schema })
}

export const db = createDb(process.env.DATABASE_URL!)
```

Tests import `createDb` and pass `DATABASE_URL_TEST`. Production code uses the default `db` export — no change in behavior.

---

### Phase 2: Server route tests

Each test file follows the same pattern:
1. `beforeEach` → `resetDb()`, create a test user
2. Test the happy path (correct request → correct response shape)
3. Test error paths (missing fields → 400, not found → 404)
4. Test edge cases (empty boards, duplicate links)

#### 2.1 Board route tests

**File:** `server/src/test/routes/boards.test.ts`

Tests:
- `GET /api/boards?root=true` — returns root board for authenticated user
- `GET /api/boards?root=true` — auto-creates root board on first access
- `GET /api/boards?root=true` — different users get different root boards
- `POST /api/boards` — creates board with title
- `POST /api/boards` — creates child board with `parentBoardId`
- `POST /api/boards` — rejects missing title (400)
- `GET /api/boards/:id` — returns board with nodes, edges, nodeLinks
- `GET /api/boards/:id` — returns 404 for non-existent board
- `GET /api/boards/:id` — returns empty arrays when board has no nodes

**Why these tests matter:** The root board auto-creation is critical — if it breaks, new users see "No board found" and the app is dead. The board detail endpoint assembles data from 4 tables; if the join/query logic changes, we need to know.

#### 2.2 Node route tests

**File:** `server/src/test/routes/nodes.test.ts`

Tests:
- `POST /api/boards/:id/nodes` — creates node with title and position
- `POST /api/boards/:id/nodes` — defaults position to 0,0 when omitted
- `POST /api/boards/:id/nodes` — rejects missing title (400)
- `PATCH /api/nodes/:id` — updates title
- `PATCH /api/nodes/:id` — updates position (positionX, positionY)
- `PATCH /api/nodes/:id` — updates onClick (JSONB field)
- `PATCH /api/nodes/:id` — rejects non-whitelisted fields (e.g., `boardId`, `id`)
- `PATCH /api/nodes/:id` — returns 404 for non-existent node
- `DELETE /api/nodes/:id` — deletes node
- `DELETE /api/nodes/:id` — returns 404 for non-existent node

**Why these tests matter:** The `PATCH` field whitelist is a security boundary — if someone accidentally removes it, arbitrary fields become writable. The position update is on the auto-save hot path; if it breaks, users lose their spatial layout.

#### 2.3 Edge route tests

**File:** `server/src/test/routes/edges.test.ts`

Tests:
- `POST /api/edges` — creates edge between two nodes
- `POST /api/edges` — rejects missing required fields (400)
- `DELETE /api/edges/:id` — deletes edge
- `DELETE /api/edges/:id` — returns 404 for non-existent edge

#### 2.4 Node link route tests

**File:** `server/src/test/routes/node-links.test.ts`

Tests:
- `POST /api/nodes/:id/link` — creates link from node to board
- `POST /api/nodes/:id/link` — rejects missing targetBoardId (400)
- `POST /api/nodes/:id/link` — rejects duplicate link (unique constraint on sourceNodeId)
- `DELETE /api/nodes/:id/link` — removes link
- `DELETE /api/nodes/:id/link` — returns 404 when no link exists

**Why these tests matter:** The unique constraint on `sourceNodeId` means a node can only link to one board. If the constraint is accidentally dropped in a migration, we'd get duplicate links silently. The test catches this.

#### 2.5 Cascade / integrity tests

**File:** `server/src/test/routes/cascades.test.ts`

Tests:
- Deleting a board cascades to its nodes
- Deleting a board cascades to its edges
- Deleting a node cascades to its edges (both as source and target)
- Deleting a node cascades to its nodeLink
- Deleting a board cascades to nodeLinks targeting it
- Creating an edge with non-existent nodeId fails (FK constraint)
- Creating a nodeLink with non-existent boardId fails (FK constraint)

**Why these tests matter:** These are the most insidious bugs. A broken cascade means orphaned rows that accumulate silently. A missing FK constraint means dangling references that cause 500s when queried. These tests are the canary.

---

### Phase 3: Frontend test infrastructure

#### 3.1 Update root vitest config

**File:** `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    root: __dirname,
    include: [
      'src/test/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'test/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    exclude: ['test/e2e.spec.ts'], // E2E tests run separately
    testTimeout: 10000,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

**Notes:**
- `environment: 'jsdom'` is needed for hook tests that use `renderHook` (React needs a DOM)
- The existing E2E test is excluded from the unit/integration suite — it requires a built Electron app
- Path alias `@/` → `src/` mirrors the Vite config so imports work in tests

#### 3.2 Dependencies

Add to root `package.json` devDependencies:
- `@testing-library/react` — for `renderHook`
- `@testing-library/react-hooks` is NOT needed (merged into `@testing-library/react` v14+)
- `jsdom` — for Vitest's jsdom environment

Add to server `package.json` devDependencies:
- `vitest`

---

### Phase 4: Frontend hook and logic tests

#### 4.1 Data transformation tests

**File:** `src/test/hooks/useBoard.test.ts`

This tests the `toFlowNodes` and `toFlowEdges` functions. They're currently defined inside `useBoard.ts` — we'll need to export them (or extract them to a separate file like `src/lib/board-transforms.ts`).

Tests:
- `toFlowNodes` converts API nodes to React Flow format (correct id, type, position, data)
- `toFlowNodes` filters out archived nodes
- `toFlowNodes` attaches `hasLink: true` and `linkedBoardId` when a nodeLink exists for the node
- `toFlowNodes` sets `hasLink: false` when no nodeLink exists
- `toFlowNodes` handles empty node array
- `toFlowNodes` handles nodes with null onClick
- `toFlowEdges` converts API edges to React Flow format (source, target, label)
- `toFlowEdges` handles undefined label → strips it

**Why these tests matter:** `toFlowNodes` is the bridge between the API and React Flow. If a field is renamed on the server or a new field is added, these tests catch the mismatch. The archived filter and link detection are business logic that silently break if the data shape changes.

To make these testable, extract them:

**File:** `src/lib/board-transforms.ts` (new, extracted from useBoard.ts)

```typescript
import type { BoardData, AtreidesNodeData } from '@/types'
import type { Node, Edge } from '@xyflow/react'

export function toFlowNodes(data: BoardData): Node<AtreidesNodeData>[] {
  // ... existing logic moved here
}

export function toFlowEdges(data: BoardData): Edge[] {
  // ... existing logic moved here
}
```

Then `useBoard.ts` imports from `@/lib/board-transforms`.

#### 4.2 Auto-save hook tests

**File:** `src/test/hooks/useAutoSave.test.ts`

Tests:
- `schedulePositionSave` calls `api.updateNode` for each node after 1 second
- Multiple rapid calls within 1 second only trigger one save (debounce)
- Subsequent calls cancel the previous pending save
- Saves the correct position values (x, y) for each node

Uses `vi.useFakeTimers()` and mocks `api.updateNode`.

**Why these tests matter:** The debounce is easy to accidentally break during refactoring. If the timeout is removed or set to 0, the server gets hammered. If the cancel logic breaks, stale positions overwrite new ones.

#### 4.3 Node action dispatch tests

**File:** `src/test/hooks/useNodeActions.test.ts`

Tests:
- `executeAction({ type: 'url', value: '...' })` calls `window.open` in browser mode
- `executeAction({ type: 'url', value: '...' })` calls `window.ipcRenderer.invoke('open-external')` in Electron mode
- `executeAction({ type: 'cli', value: '...' })` calls `window.ipcRenderer.invoke('run-cli')` in Electron mode
- `executeAction({ type: 'cli', value: '...' })` logs a warning in browser mode (no crash)
- `executeAction({ type: 'board', boardId: '...' })` calls `pushBoard` with the boardId

Uses mocks for `window.open`, `window.ipcRenderer`, and the `pushBoard` callback.

#### 4.4 API client contract tests

**File:** `src/test/lib/api.test.ts`

These tests mock `fetch` and verify that `api.ts` constructs the correct requests and handles responses properly. They catch contract drift — when someone changes a URL path, request method, or body shape.

Tests:
- `api.getRootBoard()` calls `GET /api/boards?root=true`
- `api.getBoard(id)` calls `GET /api/boards/:id`
- `api.createBoard({ title, parentBoardId })` calls `POST /api/boards` with correct body
- `api.createNode(...)` calls `POST /api/boards/:boardId/nodes` with correct body
- `api.updateNode(id, data)` calls `PATCH /api/nodes/:id` with correct body
- `api.deleteNode(id)` calls `DELETE /api/nodes/:id`
- `api.linkNodeToBoard(nodeId, targetBoardId)` calls `POST /api/nodes/:id/link`
- `api.createEdge(...)` calls `POST /api/edges` with correct body
- `api.deleteEdge(id)` calls `DELETE /api/edges/:id`
- All requests include `credentials: 'include'`
- Non-OK responses throw an error

**Why these tests matter:** The API client is the glue between frontend and backend. A typo in a URL path or a missing `credentials: 'include'` causes silent auth failures. These tests are cheap and catch real bugs.

---

### Phase 5: CLAUDE.md

**File:** `CLAUDE.md` (project root)

This file tells Claude Code how to work in this project. It should encode:
1. Project architecture (so Claude has context)
2. Testing expectations (so Claude writes tests with new code)
3. Commands to run (so Claude can verify its own work)
4. Patterns and conventions (so Claude's code matches the codebase)

```markdown
# Atreides

Spatial graph organizer — boards contain nodes and edges, nodes can link to sub-boards (portals).

## Architecture

- **Frontend**: Electron + Vite + React 18 + TypeScript + @xyflow/react v12
- **Backend**: Next.js 16 (App Router) at `server/`
- **Database**: Neon Postgres with Drizzle ORM
- **Auth**: Better Auth (email/password, session cookies)
- **Styling**: Plain CSS, Catppuccin Mocha palette

### Directory structure

```
src/                    # Electron/Vite React frontend
  components/           # React components (BoardCanvas, NodeEditor, etc.)
  hooks/                # React hooks (useBoard, useAutoSave, etc.)
  lib/                  # Utilities (api.ts, auth-client.ts, board-transforms.ts)
  types.ts              # Shared TypeScript types
  test/                 # Frontend tests
server/                 # Next.js backend
  src/app/api/          # API route handlers
  src/db/schema.ts      # Drizzle schema (boards, nodes, edges, nodeLinks)
  src/lib/              # Backend utilities (db.ts, auth.ts)
  src/test/             # Server tests
  src/middleware.ts      # CORS + auth middleware
plans/                  # Implementation plans
```

### Frontend-backend communication

- Frontend calls `server/` via HTTP (`src/lib/api.ts`)
- Auth uses session cookies (`credentials: 'include'`)
- CORS is configured in `server/src/middleware.ts`
- Dev: frontend at :5173, backend at :3001

### Key data flow

1. User authenticates → session cookie set
2. `GET /api/boards?root=true` → returns or auto-creates root board
3. `GET /api/boards/:id` → returns `{ board, nodes, edges, nodeLinks }`
4. `toFlowNodes()` / `toFlowEdges()` transform API data → React Flow format
5. Position changes debounced → `PATCH /api/nodes/:id`

## Commands

```bash
# Frontend
npm run dev          # Start Vite dev server + Electron
npm test             # Run frontend unit tests (vitest)

# Backend
cd server
npm run dev          # Start Next.js dev server (:3001)
npm test             # Run server API tests (vitest)

# Both
npm run test:all     # Run all tests (frontend + server)

# Database
cd server
npx drizzle-kit push           # Push schema changes to DB
npx drizzle-kit generate       # Generate migration files
npx @better-auth/cli migrate   # Create Better Auth tables

# Type checking
npx tsc --noEmit               # Frontend
cd server && npx tsc --noEmit  # Backend
```

## Testing practices

### When to write tests

- **Always** write tests for new API routes. Test the happy path, error cases (400/404), and response shape.
- **Always** write tests for data transformation functions (anything that maps between API shapes and UI shapes).
- **Always** write tests for hooks that manage timers, debounce, or side effects.
- **Always** run `npm test` and `cd server && npm test` after making changes to verify nothing broke.
- **Skip** tests for simple pass-through components (pure rendering with no logic).
- **Skip** tests that just re-test the framework (React Flow, Better Auth internals).

### Test patterns

**Server route tests** (`server/src/test/routes/`):
- Use `resetDb()` in `beforeEach` — every test starts with a clean database
- Use `createTestUser()` to get authenticated request context
- Call route handlers directly (no HTTP server)
- Assert response status AND body shape

**Frontend hook tests** (`src/test/hooks/`):
- Test pure functions directly (no `renderHook` needed)
- Use `vi.useFakeTimers()` for debounce/timer tests
- Mock `fetch` for API tests, mock `window.ipcRenderer` for Electron tests

**What to assert:**
- Response shapes (field names, types) — catches rename bugs
- Error status codes — catches missing validation
- Cascade behavior — catches broken foreign keys
- Debounce timing — catches timer regressions

### Before committing

1. Run `npx tsc --noEmit` (frontend) and `cd server && npx tsc --noEmit` (backend)
2. Run `npm test` (frontend) and `cd server && npm test` (backend)
3. If you added a new API route, there should be a corresponding test file
4. If you changed a data transformation, verify the transform test still passes
```

**Why CLAUDE.md matters:** Without it, Claude Code doesn't know this project uses Vitest, doesn't know to run tests, doesn't know the server is at `server/`, and doesn't know the testing conventions. With it, every future session starts with context and a testing habit.

---

### Phase 6: Package.json and script updates

#### 6.1 Root package.json

Add to `devDependencies`:
- `@testing-library/react`
- `jsdom`

Add/update scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:all": "vitest run && cd server && npx vitest run"
}
```

#### 6.2 Server package.json

Add to `devDependencies`:
- `vitest`

Add scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

## Summary: What each test layer catches

| Layer | What it catches | Example bug |
|---|---|---|
| Server route tests | Broken queries, wrong status codes, missing validation | `PATCH /nodes/:id` accepts `boardId` field (bypasses whitelist) |
| Cascade tests | Orphaned rows, broken FK constraints | Deleting a board leaves orphaned edges in the DB |
| Data transform tests | Shape mismatches between API and React Flow | `positionX` renamed to `x` on server, frontend breaks silently |
| Auto-save tests | Timer regressions, lost position updates | Debounce timeout set to 0, server gets 60 requests/second |
| API contract tests | Wrong URLs, missing credentials, body shape changes | `api.createNode` POSTs to wrong path after route rename |
| Action dispatch tests | Electron/browser mode detection, missing IPC handlers | `window.open` called in Electron instead of IPC |

---

## Implementation order

1. **Phase 1** — Server test infra (vitest config, setup.ts, db factory) → unblocks all server tests
2. **Phase 2** — Server route tests → highest value, catches real query bugs
3. **Phase 3** — Frontend test infra (vitest config update, dependencies) → unblocks frontend tests
4. **Phase 4** — Frontend tests → data transforms first (pure functions, easiest), then hooks
5. **Phase 5** — CLAUDE.md → encode the practices so they persist
6. **Phase 6** — Package.json updates → wire up the scripts
