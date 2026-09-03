# DiagramKit

## Styling

- Colors live as CSS variables in `src/index.css` (`:root` / `[data-theme]`). Tailwind utilities (`bg-canvas`, `text-muted`, `border-border`, `bg-accent`) consume those variables. Do not hardcode hex in components.
- Use Tailwind utilities for layout. Shared controls are in `src/components/ui/controls.tsx`.
- React Flow overrides live in `src/index.css` outside any `@layer` (Tailwind tree-shakes layered rules whose selectors do not appear in source). Icons are in `src/components/ui/icons.tsx`; do not use emoji or unicode glyphs as icons.

## Tech stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS, @xyflow/react
- **Backend**: Hono on Node (`server/index.ts`)
- **Data**: one JSON file per board in the **active workspace** (`index.json` + `boards/<id>.json`). Default workspace is `~/.diagramkit`. Writes are temp-file then rename. App home (workspace registry) is `~/.diagramkit/workspaces.json`. Override app home with `DIAGRAMKIT_HOME`. Board schema versions live in `migrations/NNN_slug.ts`; the server migrates on read/write. See `AGENTS.md`.

## Data

Do not add a database. Persist by saving the whole board document (`PUT /api/boards/:id`).

CLI: `diagramkit` (`./install.sh` or `./bin/diagramkit`). Commands: `serve`, `stop`, `status`, `create`, `open`, `validate`, `workspaces`.

Agent-facing docs: `AGENTS.md`, `agent-skills/diagramkit-cli`, `agent-skills/diagramkit-data-model`, `agent-skills/diagramkit-write-boards`.
