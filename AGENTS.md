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

## Unit tests

Store tests must set `DIAGRAMKIT_HOME` to a temp dir. Never point tests at `~/.diagramkit`.
