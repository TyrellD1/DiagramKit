import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function repoRoot() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
}

export function repoBin(name: string) {
  return path.join(repoRoot(), 'node_modules', '.bin', name)
}
