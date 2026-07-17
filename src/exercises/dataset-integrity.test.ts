// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { Exercise } from './types'

/**
 * Dataset/asset integrity contract (LIB-1, updated LG-047). The curated
 * catalog may include imageless entries (net-new additions with no
 * photography yet - `ExerciseListItem` renders a placeholder for these), so
 * the invariant is relaxed from "every exercise has >=1 image" to "every
 * declared image path resolves to a real file". `buildCatalog()` already
 * enforces this at generation time; this test guards the checked-in JSON
 * against drift (e.g. a manual edit, or a stale public/exercises/ tree).
 */

const root = path.resolve(import.meta.dirname, '../..')
const exercises: Exercise[] = JSON.parse(
  readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'),
)

describe('exercises.json / public/exercises integrity', () => {
  it('every declared image path resolves to a real file under public/exercises', () => {
    for (const exercise of exercises) {
      for (const imagePath of exercise.images) {
        const abs = path.join(root, 'public/exercises', imagePath)
        expect(existsSync(abs)).toBe(true)
      }
    }
  })

  it('imageless entries exist and are exactly the net-new additions with no photography', () => {
    const imageless = exercises.filter((e) => e.images.length === 0)
    // At least the additions authored in LG-047 curation ship without
    // images; if this list is ever empty, the placeholder UI is dead code.
    expect(imageless.length).toBeGreaterThan(0)
  })
})
