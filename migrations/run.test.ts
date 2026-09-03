import { describe, expect, test } from 'vitest'
import { applyMigrations, currentSchemaVersion, listMigrationFiles } from './run.ts'
import { schemaVersionOf } from './types.ts'

describe('board migrations', () => {
  test('files are numbered and the current version matches the last file', () => {
    const files = listMigrationFiles()
    expect(files[0]?.version).toBe(1)
    expect(files[0]?.slug).toBe('initial')
    expect(files[1]?.version).toBe(2)
    expect(files[1]?.slug).toBe('node_appearance')
    expect(currentSchemaVersion()).toBe(files.at(-1)?.version)
  })

  test('stamps the current schemaVersion onto a legacy board', async () => {
    const result = await applyMigrations({
      id: 'board-1',
      title: 'Home',
      nodes: [],
      edges: [],
    })
    expect(result.from).toBe(0)
    expect(result.to).toBe(currentSchemaVersion())
    expect(result.changed).toBe(true)
    expect(schemaVersionOf(result.document)).toBe(currentSchemaVersion())
    expect(result.document.nodes).toEqual([])
    expect(result.document.edges).toEqual([])
  })

  test('does not re-run migrations on a current board', async () => {
    const current = currentSchemaVersion()
    const result = await applyMigrations({
      schemaVersion: current,
      id: 'board-1',
      title: 'Home',
      nodes: [],
      edges: [],
    })
    expect(result.changed).toBe(false)
    expect(result.from).toBe(current)
    expect(result.to).toBe(current)
  })

  test('adds default color and borderStyle when upgrading from v1', async () => {
    const result = await applyMigrations({
      schemaVersion: 1,
      id: 'board-1',
      title: 'Home',
      nodes: [{
        id: 'n1',
        title: 'A',
        description: null,
        x: 0,
        y: 0,
        enterBoardId: null,
        childLink: null,
        refs: [],
      }],
      edges: [],
    })
    expect(result.from).toBe(1)
    expect(result.to).toBe(2)
    expect(result.changed).toBe(true)
    expect(result.document.nodes).toEqual([{
      id: 'n1',
      title: 'A',
      description: null,
      x: 0,
      y: 0,
      enterBoardId: null,
      childLink: null,
      refs: [],
      color: 'default',
      borderStyle: 'solid',
    }])
  })

  test('refuses a board from a newer app', async () => {
    await expect(applyMigrations({
      schemaVersion: 99,
      id: 'board-1',
      title: 'Home',
      nodes: [],
      edges: [],
    })).rejects.toThrow(/newer than this DiagramKit/)
  })
})
