## Overview

Technical setup and infrastructure plan for Atreides — a graph-based spatial organizer.

**Stack:** Electron + Vite + React 18 (renderer) | Next.js (serverless backend) | Neon Postgres | Better Auth | @xyflow/react

## High Level Goals

- [ ] Monorepo structure that cleanly separates Electron frontend from Next.js backend
- [ ] Neon Postgres database with the full schema (boards, nodes, node_links, edges)
- [ ] Better Auth wired up for email/password auth with sessions
- [ ] Electron app works in dev and production; browser mode also works (minus Electron-only features)
- [ ] Clean dev experience: one command starts everything

---

## File paths

### New files

- `server/` — New Next.js app (serverless backend), lives alongside the existing Electron frontend
- `server/package.json` — Next.js dependencies, scripts, Better Auth + Neon driver
- `server/tsconfig.json` — TypeScript config for the server
- `server/next.config.ts` — Next.js config (output: standalone for serverless)
- `server/.env.local` — Neon connection string, Better Auth secret (gitignored)
- `server/src/lib/auth.ts` — Better Auth server instance (Neon pool, email/password config)
- `server/src/lib/db.ts` — Neon database pool singleton
- `server/src/app/api/auth/[...all]/route.ts` — Better Auth catch-all API route
- `server/src/app/api/boards/route.ts` — Boards CRUD endpoints
- `server/src/app/api/boards/[id]/route.ts` — Single board GET/PATCH/DELETE
- `server/src/app/api/boards/[id]/nodes/route.ts` — Nodes for a board
- `server/src/app/api/nodes/[id]/route.ts` — Single node PATCH/DELETE
- `server/src/app/api/nodes/[id]/link/route.ts` — Node link CRUD (create/update/delete link to board)
- `server/src/app/api/edges/route.ts` — Edges CRUD
- `server/src/app/api/edges/[id]/route.ts` — Single edge DELETE
- `server/src/middleware.ts` — Session cookie check, protect /api/boards and /api/nodes
- `server/drizzle.config.ts` — Drizzle Kit config pointing at Neon
- `server/src/db/schema.ts` — Drizzle ORM schema (boards, nodes, node_links, edges)
- `server/src/db/migrations/` — Generated SQL migrations (via `drizzle-kit generate`)
- `src/lib/api.ts` — Frontend API client (fetch wrapper that hits the Next.js backend)
- `src/lib/auth-client.ts` — Better Auth client for the renderer (sign in, sign up, sign out, session)
- `.env` — `VITE_API_URL` for the renderer to know where the backend lives
- `package.json` (root) — Add a workspace-level `dev` script that starts both Electron and Next.js

### Modified files

- `package.json` — Rename to `atreides`, add `concurrently` devDep, add `dev:all` script, add proxy/env config
- `tailwind.config.js` — Enable preflight (it's currently disabled, but we need base resets for the UI)
- `src/index.css` — Clean up boilerplate styles, keep Tailwind directives and minimal resets
- `src/App.css` — Gut boilerplate logo/card styles, replace with Atreides-specific layout
- `index.html` — Update `<title>` to "Atreides"
- `electron-builder.json` — Update `appId` to `com.shestheceo.atreides`
- `.gitignore` — Add `server/.env.local`, `.env`

---

## Manual testing plan

1. Start the database: ensure you have a Neon project created and the connection string in `server/.env.local`
2. Run migrations: `cd server && npx drizzle-kit push` — verify tables created in Neon console
3. Start the backend: `cd server && npm run dev` — confirm it runs on `http://localhost:3001`
4. Test auth: `curl -X POST http://localhost:3001/api/auth/sign-up/email -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"password123","name":"Test"}'` — should return user + session
5. Start the Electron app: `npm run dev` from root — confirm the React Flow canvas loads in the Electron window
6. Verify the renderer can reach the backend: open devtools in Electron, run `fetch('http://localhost:3001/api/auth/get-session').then(r => r.json()).then(console.log)` — should return null or session
7. Test browser mode: open `http://localhost:5173` in Chrome — same React Flow canvas should render
8. Run `npm run dev:all` from root — both Electron and Next.js should start together

---

## Implementation Plan

### Architecture Decision: Monorepo structure

**Options:**

1. **Separate directories at root** (`server/` for Next.js, root for Electron) — simple, no workspace tooling needed
2. **npm/pnpm workspaces** — shared deps, hoisted node_modules, more complex config
3. **Turborepo** — overkill for two packages

**Recommendation: Option 1.** Keep it simple. The Electron app and Next.js server have almost no shared code right now. A `server/` directory with its own `package.json` is the least disruptive to the existing setup. The Electron frontend talks to the backend over HTTP — they don't share imports. If shared types become needed later, extract a `shared/` directory then. No need to pre-architect for it.

### Architecture Decision: ORM for Neon Postgres

**Options:**

1. **Raw `pg` / `@neondatabase/serverless`** — no abstraction, write SQL directly
2. **Drizzle ORM** — lightweight, SQL-like TypeScript API, great Neon support, generates migrations
3. **Prisma** — heavier, schema-first, generates client

**Recommendation: Drizzle.** It's the lightest ORM that still gives you type-safe queries and migration generation. It works natively with Neon's serverless driver. Prisma is heavier than needed here.

### Architecture Decision: How the Electron renderer talks to the backend

**Options:**

1. **Direct fetch to Next.js** — renderer makes HTTP requests to `localhost:3001` (dev) or deployed URL (prod)
2. **IPC through Electron main process** — main process proxies API calls
3. **Embedded Next.js in Electron** — run Next.js inside the Electron process

**Recommendation: Option 1.** Direct fetch is simplest and also works identically in browser mode. The API URL comes from a `VITE_API_URL` env var. In dev it's `http://localhost:3001`. In production it's wherever the Next.js backend is deployed. No IPC complexity needed.

---

### Phase 1: Project scaffolding and database

#### 1.1 Create the Next.js server

**Directory:** `server/`

Initialize a minimal Next.js app with App Router:

```bash
cd server
npx create-next-app@latest . --ts --app --src-dir --no-tailwind --no-eslint --import-alias "@/*"
```

Then install Neon + Drizzle:

```bash
npm install @neondatabase/serverless drizzle-orm
npm install -D drizzle-kit
```

**File:** `server/src/lib/db.ts`

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/db/schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

**File:** `server/.env.local`

```
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/atreides?sslmode=require
BETTER_AUTH_SECRET=generate-a-random-string-here
BETTER_AUTH_URL=http://localhost:3001
```

#### 1.2 Database schema with Drizzle

**File:** `server/src/db/schema.ts`

```typescript
import { pgTable, uuid, text, real, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(), // FK to Better Auth user table
  parentBoardId: uuid('parent_board_id').references(() => boards.id), // nullable — null for root board
  title: text('title').notNull(),
  description: text('description'),
  icon: text('icon'),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const nodes = pgTable('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),
  onClick: jsonb('on_click'),
  type: text('type'),
  tags: text('tags').array(),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const nodeLinks = pgTable('node_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceNodeId: uuid('source_node_id').notNull().unique().references(() => nodes.id, { onDelete: 'cascade' }),
  targetBoardId: uuid('target_board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  targetX: real('target_x'),
  targetY: real('target_y'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const edges = pgTable('edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  sourceNodeId: uuid('source_node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  targetNodeId: uuid('target_node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**File:** `server/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

Run migrations:

```bash
npx drizzle-kit push
```

**Notes:**
- `onDelete: 'cascade'` on nodes → boards means deleting a board deletes its nodes. Same for edges and node_links. This is correct — if you delete a board, its contents are gone.
- `parentBoardId` on boards is nullable (root board has no parent). This is a self-referential FK — a board's parent is another board. The node-to-board linking is handled separately by `node_links`.

#### 1.3 Better Auth setup

Install in server:

```bash
cd server
npm install better-auth
```

**File:** `server/src/lib/auth.ts`

```typescript
import { betterAuth } from 'better-auth'
import { Pool } from '@neondatabase/serverless'

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
  },
})
```

**File:** `server/src/app/api/auth/[...all]/route.ts`

```typescript
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

**File:** `server/src/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  // Protect all API routes except auth
  if (!sessionCookie && request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
```

---

### Phase 2: Frontend API client and auth

#### 2.1 Auth client in the renderer

Install in Electron frontend:

```bash
npm install better-auth
```

**File:** `src/lib/auth-client.ts`

```typescript
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
})
```

**File:** `.env`

```
VITE_API_URL=http://localhost:3001
```

#### 2.2 API client for boards/nodes/edges

**File:** `src/lib/api.ts`

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include', // send session cookies
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export const api = {
  // Boards
  getBoard: (id: string) => request(`/api/boards/${id}`),
  getRootBoard: () => request('/api/boards?root=true'),
  createBoard: (data: { title: string; parentBoardId?: string }) =>
    request('/api/boards', { method: 'POST', body: JSON.stringify(data) }),

  // Nodes
  getNodesForBoard: (boardId: string) => request(`/api/boards/${boardId}/nodes`),
  createNode: (data: { boardId: string; title: string; positionX: number; positionY: number }) =>
    request(`/api/boards/${data.boardId}/nodes`, { method: 'POST', body: JSON.stringify(data) }),
  updateNode: (id: string, data: Partial<{ title: string; description: string; positionX: number; positionY: number }>) =>
    request(`/api/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteNode: (id: string) =>
    request(`/api/nodes/${id}`, { method: 'DELETE' }),

  // Node Links
  linkNodeToBoard: (nodeId: string, targetBoardId: string) =>
    request(`/api/nodes/${nodeId}/link`, { method: 'POST', body: JSON.stringify({ targetBoardId }) }),

  // Edges
  createEdge: (data: { boardId: string; sourceNodeId: string; targetNodeId: string }) =>
    request('/api/edges', { method: 'POST', body: JSON.stringify(data) }),
  deleteEdge: (id: string) =>
    request(`/api/edges/${id}`, { method: 'DELETE' }),
}
```

---

### Phase 3: Cleanup and dev experience

#### 3.1 Update package.json

Add `concurrently` and a unified dev script:

```json
{
  "name": "atreides",
  "scripts": {
    "dev": "vite --host",
    "dev:server": "cd server && npm run dev",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:server\"",
    "build": "tsc && vite build && electron-builder"
  }
}
```

#### 3.2 Cleanup boilerplate

- `index.html` — Change `<title>` to "Atreides"
- `electron-builder.json` — Change `appId` to `com.shestheceo.atreides`
- `tailwind.config.js` — Set `preflight: true` (remove `corePlugins` block) so Tailwind resets are active
- `src/index.css` — Strip boilerplate styles, keep Tailwind directives + minimal body reset
- `src/App.css` — Gut the logo/card styles, will be replaced in v1

#### 3.3 CORS for development

**File:** `server/next.config.ts`

The Next.js dev server needs to allow requests from the Electron renderer (different port). Add CORS headers:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : '' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ]
  },
}

export default nextConfig
```

**Notes:**
- In production, the CORS origin should be the actual Electron app origin or the deployed frontend URL.
- `credentials: 'include'` on the frontend + `Allow-Credentials: true` on the backend is required for Better Auth session cookies to work cross-origin.
