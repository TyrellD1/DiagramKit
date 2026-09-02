import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export function gitRevision(root: string): string | null {
  const rev = spawnSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
    timeout: 2000,
  })
  if (rev.status !== 0) return null
  const sha = rev.stdout.trim()
  if (!sha) return null
  const dirty = spawnSync('git', ['-C', root, 'status', '--porcelain'], {
    encoding: 'utf8',
    timeout: 2000,
  })
  const isDirty = dirty.status === 0 && dirty.stdout.trim().length > 0
  return isDirty ? `${sha}-dirty` : sha
}

export function formatVersion(version: string, git: string | null, root: string): string {
  const first = git ? `${version} (${git})` : version
  return `${first}\n${root}`
}

export async function readVersion(root: string): Promise<string> {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { version?: string }
  return formatVersion(pkg.version ?? '0.0.0', gitRevision(root), root)
}
