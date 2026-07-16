import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '@/db/ledger'
import * as repos from '@/db/repos'

/**
 * LIB-4 regression guard: equipment is read-only display/filter data derived
 * from the bundled catalog. There must be NO equipment entity, table, repo, or
 * mutation path anywhere. The Builder verified this once by hand (grep) during
 * LG-005; this test makes the invariant permanent so a future commit that adds
 * an equipment write surface fails CI instead of slipping through silently.
 *
 * The single sanctioned equipment-shaped field is the optional freetext
 * `equipmentTag?` on `CustomExercise` (LG-007 / LIB-6) - a display tag, not an
 * entity - which is explicitly allowed below.
 */

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('LIB-4: equipment is read-only display data', () => {
  it('the Dexie schema declares no equipment table', () => {
    const tableNames = db.tables.map((t) => t.name)
    expect(tableNames).not.toContain('equipment')
    expect(tableNames.some((name) => /equipment/i.test(name))).toBe(false)
    // The instance exposes no equipment table accessor either.
    expect((db as unknown as Record<string, unknown>).equipment).toBeUndefined()
  })

  it('the repos barrel exposes no equipment repository', () => {
    const repoKeys = Object.keys(repos)
    expect(repoKeys.some((key) => /equipment/i.test(key))).toBe(false)
  })

  it('no source file defines an equipment mutation path', () => {
    // Function/method identifiers that would constitute a write surface, e.g.
    // createEquipment, updateEquipment, saveEquipment, upsertEquipment,
    // deleteEquipment, setEquipment, addEquipment, removeEquipment.
    // (A Dexie equipment *table* is already ruled out by the schema test above,
    // which inspects the live `db.tables` rather than string-matching source.)
    const mutationIdentifier =
      /\b(create|update|delete|save|set|add|remove|upsert|put)Equipment\b/i

    const offenders: string[] = []
    for (const file of collectSourceFiles(srcRoot)) {
      const text = readFileSync(file, 'utf-8')
      if (mutationIdentifier.test(text)) {
        offenders.push(path.relative(srcRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })
})
