// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { Exercise } from './types'

/**
 * Dataset/asset integrity contract (LIB-1). Verifies the vendored
 * exercises.json and the vendored public/exercises images agree: every
 * exercise has at least one image, and every declared image path resolves
 * to a real file on disk.
 */

const root = path.resolve(import.meta.dirname, '../..')
const exercises: Exercise[] = JSON.parse(
  readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'),
)

describe('exercises.json / public/exercises integrity', () => {
  it('every exercise has at least one image', () => {
    for (const exercise of exercises) {
      expect(exercise.images.length).toBeGreaterThan(0)
    }
  })

  it('every declared image path resolves to a real file under public/exercises', () => {
    for (const exercise of exercises) {
      for (const imagePath of exercise.images) {
        const abs = path.join(root, 'public/exercises', imagePath)
        expect(existsSync(abs)).toBe(true)
      }
    }
  })
})
