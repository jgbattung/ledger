/**
 * Read-only in-memory catalog over the bundled exercise dataset (LG-004).
 * No Dexie, no repo-layer involvement - `ExerciseRef` with `source: 'db'`
 * resolves through `getExerciseById`.
 */
import exercises from './exercises.json'
import type { Exercise } from './types'

let byId: Map<string, Exercise> | null = null

function getIndex(): Map<string, Exercise> {
  if (!byId) {
    byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  }
  return byId
}

export function getAllExercises(): Exercise[] {
  return exercises
}

export function getExerciseById(id: string): Exercise | undefined {
  return getIndex().get(id)
}

export function exerciseImageUrl(imagePath: string): string {
  return `${import.meta.env.BASE_URL}exercises/${imagePath}`
}
