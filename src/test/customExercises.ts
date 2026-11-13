import { useCustomExerciseStore } from '@/stores/customExerciseStore'

/** Empties the custom exercise store and reloads it from Dexie. Call it after
 * seeding rows (or after `resetDb()`) in component tests that involve custom
 * exercises, since a freshly rendered page starts with an empty store. */
export async function resetAndHydrateCustomExercises(): Promise<void> {
  useCustomExerciseStore.setState({ byId: {}, hydrated: false })
  await useCustomExerciseStore.getState().hydrate()
}
