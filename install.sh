#!/usr/bin/env bash
# Install the DiagramKit CLI onto PATH.
#
# From a checkout:
#   ./install.sh
#
# One-liner (once you are inside the repo):
#   bash install.sh
set -euo pipefail

if [[ -z "${BASH_SOURCE[0]:-}" || ! -f "${BASH_SOURCE[0]}" ]]; then
  echo "error: run this script from a DiagramKit checkout (not via curl | bash yet)." >&2
  echo "hint: clone the repo, then:  cd diagramkit && ./install.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$ROOT/package.json" ]] || ! grep -q '"name": "diagramkit"' "$ROOT/package.json"; then
  echo "error: $ROOT does not look like a DiagramKit repo" >&2
  exit 1
fi

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: need $1 on PATH" >&2
    exit 1
  }
}

need node
need npm

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 18 )); then
  echo "error: Node.js 18+ is required (found $(node -v))" >&2
  exit 1
fi

BIN_DIR="${DIAGRAMKIT_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$BIN_DIR"

echo "Installing npm dependencies in $ROOT"
(cd "$ROOT" && npm install)

echo "Building the UI"
(cd "$ROOT" && npm run build)

chmod +x "$ROOT/bin/diagramkit" "$ROOT/install.sh"
ln -sfn "$ROOT/bin/diagramkit" "$BIN_DIR/diagramkit"

echo
echo "Installed: $BIN_DIR/diagramkit -> $ROOT/bin/diagramkit"

if ! command -v diagramkit >/dev/null 2>&1; then
  echo
  echo "diagramkit is not on PATH yet. Add this to your shell rc:"
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi

echo
echo "Next:"
echo "  diagramkit serve"
echo "  diagramkit create ~/.diagram-kit-local1"
echo "  diagramkit open ~/.diagram-kit-local1"
echo "  diagramkit help"
