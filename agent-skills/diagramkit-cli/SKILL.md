---
name: diagramkit-cli
description: Use the DiagramKit CLI to install, serve, create, open, validate, and export workspaces. Use when the user mentions diagramkit, starting the app from a terminal, scaffolding a workspace, attaching a folder, checking board JSON, or exporting PNG screenshots.
---

# DiagramKit CLI

Binary: `diagramkit`. Prefer it over curling `/api/workspaces`.

Agents: never write boards into `~/.diagramkit` or `~/diagram-kit`. Test in `~/.diagram-kit-local1` (and `local2`). Always pass `--no-browser`.

## Install

From a repo checkout:

```sh
./install.sh
```

Puts `diagramkit` on `$DIAGRAMKIT_BIN_DIR` or `~/.local/bin`. Needs Node 18+. `diagramkit version` prints the package version, git revision, and checkout path so you can tell which clone the binary is.

Or from the checkout without installing: `./bin/diagramkit help`.

## Commands

```sh
diagramkit help
diagramkit help open
diagramkit version                    # version, git rev, checkout path

diagramkit serve                          # background; default port 3001
diagramkit serve --port 4000 --dev -f     # Vite + API, foreground
diagramkit stop
diagramkit status [--json]
diagramkit logs [-f]

diagramkit create ~/.diagram-kit-local1
diagramkit open ~/.diagram-kit-local1 --no-browser
diagramkit validate ~/.diagram-kit-local1
diagramkit workspaces
diagramkit export [board]                 # PNG zip of a board + nested children
```

`export` screenshots via Playwright (same path as the in-app download button). Needs Chromium (`npx playwright install chromium`). Defaults to the Home board. `--out file.zip` writes a zip; `--out ./dir` (no `.zip`) writes PNGs into that folder.

`open` validates first, attaches the folder (adds it to `~/.diagramkit/workspaces.json` if missing), switches it active, and starts the server if nothing is listening. If the path does not exist it exits 2 and tells you to `create`. If the JSON is invalid it prints file + JSON path + message and does not attach. `validate` does not run `migrations/`; the server migrates boards on read/write. See `AGENTS.md`.

`create` only scaffolds `index.json` + `boards/` + Home. It does not attach. It refuses to overwrite an existing workspace.

## Flags that matter

| Flag | Where | Default |
|------|--------|---------|
| `--port` / `-p` | serve, open, export | `3001` |
| `--host` | serve, open | `127.0.0.1` |
| `--web-port` | serve `--dev` | `5173` |
| `--dev` | serve, open | production UI on `--port` |
| `--foreground` / `-f` | serve | background |
| `--no-browser` | open, create `--open` | **agents: always set this** |
| `--no-serve` | open | attach only |
| `--out` | export | `<title>-export.zip` in cwd |
| `--theme` | export | `light` |
| `--json` | validate, status, workspaces | text |

App home (registry, pid file, logs): `~/.diagramkit` or `$DIAGRAMKIT_HOME`. Isolate CLI tests with `DIAGRAMKIT_HOME=/tmp/...`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | ok |
| 1 | usage or invalid workspace |
| 2 | path not found |
| 3 | server not running (`stop` / `status` / `logs`) |

## Typical agent sequence

```sh
diagramkit create ~/.diagram-kit-local1
diagramkit open ~/.diagram-kit-local1 --no-browser
diagramkit validate ~/.diagram-kit-local1
# then GET/PUT http://127.0.0.1:3001/api/boards …
```

If `npm run dev` is already up, `open` reuses that API instead of starting a second server.

Verbose schema errors look like:

```
boards/<id>.json  $.nodes[0].enterBoardId
  board "…" is not in this workspace
```

Fix the pointed file and key; do not invent a database.
