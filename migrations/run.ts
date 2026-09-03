import { readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import type { JsonObject, Migration } from './types.ts'
import { isJsonObject, schemaVersionOf } from './types.ts'

const FILE = /^(\d{3})_([a-z0-9_]+)\.ts$/

function migrationsDir() {
  return path.dirname(fileURLToPath(import.meta.url))
}

export function listMigrationFiles() {
  const dir = migrationsDir()
  return readdirSync(dir)
    .map(name => {
      const match = name.match(FILE)
      if (!match) return null
      return {
        name,
        version: Number(match[1]),
        slug: match[2],
        path: path.join(dir, name),
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.version - b.version || a.name.localeCompare(b.name))
}

export function currentSchemaVersion() {
  const files = listMigrationFiles()
  return files.at(-1)?.version ?? 0
}

let loaded: Migration[] | null = null

export async function loadMigrations(): Promise<Migration[]> {
  if (loaded) return loaded
  const files = listMigrationFiles()
  const seen = new Set<number>()
  const migrations: Migration[] = []
  for (const file of files) {
    if (seen.has(file.version)) {
      throw new Error(`duplicate migration version ${String(file.version).padStart(3, '0')}`)
    }
    seen.add(file.version)
    const mod = await import(pathToFileURL(file.path).href) as {
      version?: unknown
      up?: unknown
    }
    if (mod.version !== file.version) {
      throw new Error(`${file.name} must export version = ${file.version}`)
    }
    if (typeof mod.up !== 'function') {
      throw new Error(`${file.name} must export function up(doc)`)
    }
    migrations.push({
      version: file.version,
      name: file.slug,
      up: mod.up as Migration['up'],
    })
  }
  loaded = migrations
  return migrations
}

export interface MigrateResult {
  document: JsonObject
  from: number
  to: number
  changed: boolean
}

export async function applyMigrations(input: unknown): Promise<MigrateResult> {
  if (!isJsonObject(input)) {
    throw new Error('board document must be an object')
  }
  const migrations = await loadMigrations()
  const current = currentSchemaVersion()
  const from = schemaVersionOf(input)
  if (from > current) {
    throw new Error(`board schemaVersion ${from} is newer than this DiagramKit (${current})`)
  }

  let doc: JsonObject = { ...input }
  for (const migration of migrations) {
    if (migration.version <= from) continue
    doc = migration.up(doc)
    doc.schemaVersion = migration.version
  }

  const to = schemaVersionOf(doc)
  return { document: doc, from, to, changed: from !== to }
}
