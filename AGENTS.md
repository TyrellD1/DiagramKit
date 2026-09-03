# Agent notes

Setup (CLI install and skills): [AGENTS_README.md](AGENTS_README.md).

Prefer the CLI (`diagramkit`) for create / open / validate / serve. Skill: `agent-skills/diagramkit-cli`. Always pass `--no-browser`. Isolate tests with `DIAGRAMKIT_HOME` when the command would touch the registry.

## User data is off limits

The human's real boards live in:

- `~/.diagramkit` (default workspace: `index.json`, `boards/`)
- `~/diagram-kit` if they attach it

Do **not** create, edit, move, or delete boards there unless the user explicitly asks to migrate or change that data.

`~/.diagramkit/workspaces.json` is the registry of attached workspaces. You may add sandbox attachments to it. You may switch the active workspace. Do not rewrite or delete the default workspace entry, and do not delete files under `~/.diagramkit/boards/`.

## Where to test

Before any UI, API, or filesystem check that writes boards:

1. Attach and switch to `~/.diagram-kit-local1`
2. Put all test boards there
3. If you need two workspaces, use `~/.diagram-kit-local1` and `~/.diagram-kit-local2`

```sh
diagramkit create ~/.diagram-kit-local1
diagramkit open ~/.diagram-kit-local1 --no-browser
```

Or Attach folder in the sidebar: `~/.diagram-kit-local1`.

When done switching for a test, leave the active workspace on a `~/.diagram-kit-local*` path. Do not switch back to Default just to "clean up" if that would display or risk writing user boards.

## Board JSON migrations

Boards are versioned JSON documents. Do not add SQLite. Schema changes go in `migrations/` as ordered files:

```
migrations/001_initial.ts
migrations/002_short_slug.ts
```

- The filename prefix is the version *after* `up` runs (`001_` → `schemaVersion: 1`).
- Each file exports `version` (must match the prefix) and `up(doc)` which takes a plain object and returns the next shape. The runner then sets `schemaVersion`.
- Missing `schemaVersion` is version 0. `001_initial.ts` is the original document (id, title, nodes, edges). Current shape is the highest prefix (`002_node_appearance.ts` adds `color` and `borderStyle` on nodes).
- **Never edit a shipped migration.** Add the next `NNN_slug.ts`. Do not skip numbers. Do not use timestamps.
- The server migrates on `GET`/`PUT` of a board and writes the upgraded file. `diagramkit validate` checks files as they sit on disk and does not migrate.
- If `schemaVersion` is higher than the newest file, refuse to load the board (it came from a newer app).
- New boards get `schemaVersion` equal to the highest prefix. After you add `002_`, new files are born at 2.
- Test migrations with `DIAGRAMKIT_HOME` set to a temp dir, or with boards in `~/.diagram-kit-local1`. Do not hand-edit `~/.diagramkit` to bump versions; opening a board in the app does that.

## Unit tests

Store tests must set `DIAGRAMKIT_HOME` to a temp dir. Never point tests at `~/.diagramkit`.
