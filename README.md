# DiagramKit

![DiagramKit](docs/header.png)

A spatial board for notes, projects, and links. Everything lives as JSON on your machine. No account, no database.

## Install

Node 18+. From a checkout:

```sh
./install.sh
diagramkit serve
```

That puts `diagramkit` on `~/.local/bin` and starts the app in the background at [http://127.0.0.1:3001](http://127.0.0.1:3001).

```sh
diagramkit create ~/my-workspace
diagramkit open ~/my-workspace
diagramkit stop
```

`diagramkit help` lists the rest (`status`, `logs`, `validate`, flags for port and host).

From source without installing: `npm install && npm run dev` (UI at http://localhost:5173).

## How it stores data

Default workspace: `~/.diagramkit` (`index.json` + `boards/<id>.json`). Attach any other folder of that shape. The registry is `~/.diagramkit/workspaces.json`.

## Agents

Install, skills, and the “don’t touch the human’s boards” rules: [AGENTS_README.md](AGENTS_README.md).
