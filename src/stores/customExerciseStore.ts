import { create } from 'zustand'
import { customExercises } from '@/db/repos/customExercises'
import type { CustomExercise } from '@/db/types'

/**
 * Every custom exercise (deleted ones too, flagged by `deletedAt`) held in
 * memory and loaded before first render, so synchronous lookups such as
 * `exerciseName` resolve custom refs and a deleted exercise keeps its real
 * name. Write-through: the repo write happens first, state follows once it
 * resolves.
 */

export type CustomExerciseInput = Pick<
  CustomExercise,
  'name' | 'primaryMuscles' | 'secondaryMuscles' | 'equipmentTag' | 'mechanic' | 'notes'
>

type CustomExerciseState = {
  byId: Record<string, CustomExercise>
  hydrated: boolean
  hydrate: () => Promise<void>
  create: (input: CustomExerciseInput) => Promise<CustomExercise>
  update: (id: string, input: CustomExerciseInput) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCustomExerciseStore = create<CustomExerciseState>()((set, get) => ({
  byId: {},
  hydrated: false,

  async hydrate() {
    const rows = await customExercises.listAll()
    set({
      byId: Object.fromEntries(rows.map((row) => [row.id, row])),
      hydrated: true,
    })
  },

  async create(input) {
    const row = await customExercises.create(input)
    set((state) => ({ byId: { ...state.byId, [row.id]: row } }))
    return row
  },

  async update(id, input) {
    await customExercises.update(id, input)
    const row = await customExercises.get(id)
    if (row) set((state) => ({ byId: { ...state.byId, [id]: row } }))
  },

  async remove(id) {
    await customExercises.softDelete(id)
    const current = get().byId[id]
    if (!current) return
    const deletedAt = (await customExercises.listAll()).find((r) => r.id === id)?.deletedAt
    set((state) => ({
      byId: {
        ...state.byId,
        [id]: { ...current, deletedAt: deletedAt ?? Date.now() },
      },
    }))
  },
}))

let liveSource: Record<string, CustomExercise> | null = null
let liveCache: CustomExercise[] = []

/** Live (not deleted) custom exercises in case-insensitive name order.
 * Memoised on `byId`, so it is safe as a Zustand selector. */
export function selectLive(state: Pick<CustomExerciseState, 'byId'>): CustomExercise[] {
  if (liveSource !== state.byId) {
    liveSource = state.byId
    liveCache = Object.values(state.byId)
      .filter((row) => row.deletedAt == null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }
  return liveCache
}

/** Non-hook lookup that includes deleted rows. */
export function getCustomExercise(id: string): CustomExercise | undefined {
  return useCustomExerciseStore.getState().byId[id]
}
