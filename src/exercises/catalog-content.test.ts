/**
 * Content-level accept tests for the LG-047 curated catalog: the
 * acceptance-criteria coverage trio, the alias accept test, taxonomy/id
 * conformance, and the drift test that pins the checked-in
 * `exercises.json` to the curation pipeline's `buildCatalog()` output so
 * decisions and dataset can never silently diverge.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCatalog } from '../../scripts/curation/curate.ts'
import type { SeedExercise } from '../../scripts/curation/curate.ts'
import keeps from '../../scripts/curation/keeps.ts'
import drops from '../../scripts/curation/drops.ts'
import additions from '../../scripts/curation/additions.ts'
import { getAllExercises } from './catalog'
import { filterExercises } from './filtering'
import type { Category, Equipment, Mechanic, Muscle } from './types'

const MUSCLES: Muscle[] = [
  'chest',
  'lats',
  'upper back',
  'lower back',
  'traps',
  'front delts',
  'side delts',
  'rear delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
]
const EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'smith machine',
  'bodyweight',
  'band',
  'kettlebell',
  'ez bar',
  'other',
]
const CATEGORIES: Category[] = ['strength', 'cardio', 'mobility']
const MECHANICS: Mechanic[] = ['compound', 'isolation']

describe('AC coverage trio (LG-047)', () => {
  it('finds "Wide Grip Cable Row" via search', () => {
    const results = filterExercises('wide grip cable row', {
      muscle: null,
      category: null,
      equipment: null,
    })
    expect(results.some((e) => e.name === 'Wide Grip Cable Row')).toBe(true)
  })

  it('finds "Machine Hamstring Curl" via alias search', () => {
    const results = filterExercises('machine hamstring curl', {
      muscle: null,
      category: null,
      equipment: null,
    })
    expect(results.some((e) => e.aliases.includes('Machine Hamstring Curl'))).toBe(true)
  })

  it('finds "Incline Close Grip Bench Press" via search', () => {
    const results = filterExercises('incline close grip bench press', {
      muscle: null,
      category: null,
      equipment: null,
    })
    expect(results.some((e) => e.name === 'Incline Close Grip Bench Press')).toBe(true)
  })
})

describe('alias accept test', () => {
  it('"pull ups" resolves the Pull-Up entry', () => {
    const results = filterExercises('pull ups', { muscle: null, category: null, equipment: null })
    expect(results.some((e) => e.name === 'Pull-Up')).toBe(true)
  })
})

describe('catalog conformance', () => {
  const all = getAllExercises()

  it('every id is kebab-case and unique', () => {
    const ids = all.map((e) => e.id)
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry conforms to the owned taxonomy unions', () => {
    for (const exercise of all) {
      for (const m of [...exercise.primaryMuscles, ...exercise.secondaryMuscles]) {
        expect(MUSCLES).toContain(m)
      }
      expect(EQUIPMENT).toContain(exercise.equipment)
      expect(CATEGORIES).toContain(exercise.category)
      expect(MECHANICS).toContain(exercise.mechanic)
      expect(exercise.primaryMuscles.length).toBeGreaterThan(0)
    }
  })
})

describe('drift test', () => {
  it('checked-in exercises.json matches buildCatalog(seed, decisions) exactly', () => {
    const root = path.resolve(import.meta.dirname, '../..')
    const seedPath = path.join(root, 'scripts/curation/seed/free-exercise-db.json')
    const seed: SeedExercise[] = JSON.parse(readFileSync(seedPath, 'utf-8'))
    const checkedIn = JSON.parse(readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'))

    const { exercises } = buildCatalog(seed, { keeps, drops, additions })
    expect(exercises).toEqual(checkedIn)
  })
})
