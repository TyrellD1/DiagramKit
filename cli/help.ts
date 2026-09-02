const GLOBAL = `DiagramKit CLI

Usage:
  diagramkit <command> [options]

Commands:
  serve              Start the app (background by default)
  stop               Stop a background server
  status             Show whether the server is running
  logs               Print serve logs
  create <path>      Scaffold a workspace directory
  open <path>        Validate, attach, and open a workspace
  validate <path>    Check workspace JSON against the schema
  workspaces         List attached workspaces
  help [command]     Show help
  version            Print version, git revision, and checkout path

Exit codes:
  0  ok
  1  usage or validation error
  2  path not found
  3  server not running

Agents: never write boards into ~/.diagramkit. Use ~/.diagram-kit-local1.
Prefer this CLI over curling /api/workspaces. Pass --no-browser.
`

const SERVE = `diagramkit serve [options]

Start the DiagramKit server. Background by default (pid + logs under
the app home, usually ~/.diagramkit).

Without --dev this serves the production UI from dist/. Source newer
than dist is rebuilt automatically. npm run dev always uses live source.

Options:
  -p, --port <n>       API / production UI port (default 3001)
      --host <addr>    Bind address (default 127.0.0.1)
      --web-port <n>   Vite UI port in --dev (default 5173)
      --dev            Vite + API with live reload
  -f, --foreground     Stay in the terminal
      --open           Open the UI in a browser
  -h, --help           Show this help

If a server this CLI started is already running, prints its URL
instead of binding twice.

Examples:
  diagramkit serve
  diagramkit serve --port 4000 --open
  diagramkit serve --dev --foreground
`

const STOP = `diagramkit stop

Stop the background process started by diagramkit serve.

Exit 3 if nothing is running.
`

const STATUS = `diagramkit status [options]

Show pid, url, and mode if a diagramkit serve process is alive.

Options:
      --json           Print JSON
  -h, --help           Show this help

Exit 3 if not running.
`

const LOGS = `diagramkit logs [options]

Print ~/.diagramkit/serve.log (or $DIAGRAMKIT_HOME/serve.log).

Options:
  -f, --follow         Tail the log
  -h, --help           Show this help
`

const CREATE = `diagramkit create <path> [options]

Create a new workspace at <path>: index.json, boards/, and a Home board.
Does not attach it. Does not overwrite an existing workspace.

Options:
      --open           Attach and open after creating
      --name <name>    Sidebar name if also opening
      --no-browser     With --open, skip opening a browser
  -h, --help           Show this help

If <path> does not exist it is created. If it already has index.json,
the command fails and tells you to use diagramkit open.

Examples:
  diagramkit create ~/.diagram-kit-local1
  diagramkit create ./my-ws --open --no-browser
`

const OPEN = `diagramkit open <path> [options]

Validate the workspace, attach it (add to the registry if needed),
switch it active, start the server if it is down, and open the UI.

Options:
      --name <name>    Sidebar label for a new attachment
      --no-browser     Do not open a browser (agents: use this)
      --no-serve       Attach only; do not start the server
  -p, --port <n>       Port if starting a server (default 3001)
      --host <addr>    Bind address if starting a server
      --dev            Start with Vite live reload
  -h, --help           Show this help

If <path> does not exist:
  error, exit 2, suggests diagramkit create <path>
If it exists but is invalid:
  prints validate errors, exit 1, does not attach

Examples:
  diagramkit open ~/.diagram-kit-local1 --no-browser
  diagramkit open ./my-ws
`

const VALIDATE = `diagramkit validate <path> [options]

Check every index.json and boards/<id>.json file against the schema.
Prints file + JSON path + message for each problem.

Options:
      --json           Print JSON { ok, path, boardCount, issues }
  -h, --help           Show this help

Exit 1 if invalid. Exit 2 if the path does not exist.

Examples:
  diagramkit validate ~/.diagram-kit-local1
  diagramkit validate ./my-ws --json
`

const WORKSPACES = `diagramkit workspaces [options]

List workspaces from ~/.diagramkit/workspaces.json.

Options:
      --json           Print JSON
  -h, --help           Show this help
`

const HELP: Record<string, string> = {
  serve: SERVE,
  stop: STOP,
  status: STATUS,
  logs: LOGS,
  create: CREATE,
  open: OPEN,
  validate: VALIDATE,
  workspaces: WORKSPACES,
  help: GLOBAL,
  version: `diagramkit version\n\nPrint package.json version, git revision, and the checkout this binary runs from.\n`,
}

export function helpText(command?: string) {
  if (!command) return GLOBAL.trim()
  return (HELP[command] ?? GLOBAL).trim()
}
