import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'

const EXPECTED_TABLES = [
  'customExercises',
  'exerciseMeta',
  'programs',
  'programDays',
  'programExercises',
  'workouts',
  'workoutExercises',
  'sets',
  'bodyMetrics',
  'photos',
  'settings',
  'syncState',
]

describe('ledger schema v1', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('opens and defines every table from PRD §3.2-3.12 and §3.14', () => {
    const names = db.tables.map((table) => table.name).sort()
    expect(names).toEqual([...EXPECTED_TABLES].sort())
    expect(db.tables).toHaveLength(12)
  })

  it('uses client-generated string keys with no auto-increment anywhere', () => {
    for (const table of db.tables) {
      expect(table.schema.primKey.auto).toBe(false)
    }
  })

  it('keys every synced table on `id` and syncState on the [table+recordId] compound key', () => {
    for (const table of db.tables) {
      if (table.name === 'syncState') {
        expect(table.schema.primKey.keyPath).toEqual(['table', 'recordId'])
      } else {
        expect(table.schema.primKey.keyPath).toBe('id')
      }
    }
  })

  it('does not declare the unqueryable boolean `isActive` index on the programs store', () => {
    // IndexedDB keys cannot be boolean, so an `isActive` secondary index can
    // never be queried; setActive() scans via filter() instead. Guard against
    // the dead index being reintroduced (LG-002 Phase 4 remediation).
    const indexNames = db.programs.schema.indexes.map((index) => index.name)
    expect(indexNames).not.toContain('isActive')
    expect(indexNames).toEqual(['deletedAt'])
  })
})
