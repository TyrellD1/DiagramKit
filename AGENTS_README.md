# DiagramKit for agents

Human product README: [README.md](README.md). Operational boundaries: [AGENTS.md](AGENTS.md).

## CLI

From a checkout (Node 18+):

```sh
./install.sh
```

Or run without installing: `./bin/diagramkit help`.

Always pass `--no-browser`. Isolate registry/pid/logs with `DIAGRAMKIT_HOME` when you are not using the user’s app.

```sh
diagramkit create ~/.diagram-kit-local1
diagramkit open ~/.diagram-kit-local1 --no-browser
diagramkit validate ~/.diagram-kit-local1
diagramkit serve                          # skip if already up
diagramkit help
```

Never write boards into `~/.diagramkit` or `~/diagram-kit`. Test in `~/.diagram-kit-local1` (and `local2`). Details in `AGENTS.md`.

## Skills

Repo skills are in `agent-skills/`. Point your agent at them (copy or symlink into its skill directory):

| Skill | Use for |
|---|---|
| `agent-skills/diagramkit-cli` | install, serve, create, open, validate |
| `agent-skills/diagramkit-data-model` | JSON shape, `enterBoardId` vs `childLink` |
| `agent-skills/diagramkit-write-boards` | HTTP API and file writes |

Examples:

```sh
# Cursor (this repo)
mkdir -p .cursor/skills
ln -sfn ../../agent-skills/diagramkit-cli .cursor/skills/diagramkit-cli
ln -sfn ../../agent-skills/diagramkit-data-model .cursor/skills/diagramkit-data-model
ln -sfn ../../agent-skills/diagramkit-write-boards .cursor/skills/diagramkit-write-boards

# Claude Code (user skills)
mkdir -p ~/.claude/skills
ln -sfn "$(pwd)/agent-skills/diagramkit-cli" ~/.claude/skills/diagramkit-cli
ln -sfn "$(pwd)/agent-skills/diagramkit-data-model" ~/.claude/skills/diagramkit-data-model
ln -sfn "$(pwd)/agent-skills/diagramkit-write-boards" ~/.claude/skills/diagramkit-write-boards
```

Prefer the CLI for workspaces. Prefer `GET`/`PUT /api/boards/:id` for board edits while the server is running.
