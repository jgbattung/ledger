import { create } from 'zustand'
import type { ExerciseRef } from '@/db/types'
import { getExerciseById } from '@/exercises/catalog'
import type { Equipment, Mechanic, Muscle } from '@/exercises/types'
import { getCustomExercise } from '@/stores/customExerciseStore'

/**
 * In-memory draft of the custom exercise form. Lives here (not in the page)
 * so it survives the trip to the muscle page, like `programDraftStore`. Not
 * persisted: it reaches Dexie only through `customExerciseStore`.
 */

export type FormMode = 'new' | 'edit' | 'duplicate'
export type PickOrigin = 'program' | 'swap'

export type FormDraft = {
  name: string
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipmentTag?: Equipment
  mechanic?: Mechanic
  notes: string
}

export type StartOptions = {
  mode: FormMode
  /** New: prefill the name (the picker's "Create '<query>'"). */
  name?: string
  /** Duplicate: the exercise to copy from. */
  from?: ExerciseRef
  /** Edit: the custom exercise being edited. */
  editingId?: string
  pickOrigin?: PickOrigin
}

type FormState = {
  draft: FormDraft
  /** JSON snapshot of the draft right after `start`, for dirty checks. */
  baseline: string
  /** Null until `start` has run for the current visit. */
  mode: FormMode | null
  editingId: string | null
  pickOrigin: PickOrigin | null
  /** A just-created exercise a picker consumes on mount (decision D). */
  pendingPick: ExerciseRef | null

  start: (options: StartOptions) => void
  setName: (name: string) => void
  /** Adding a primary removes it from secondary. */
  setPrimaryMuscles: (muscles: Muscle[]) => void
  /** Anything already primary is dropped. */
  setSecondaryMuscles: (muscles: Muscle[]) => void
  setEquipmentTag: (value: Equipment | undefined) => void
  setMechanic: (value: Mechanic) => void
  setNotes: (notes: string) => void
  setPendingPick: (ref: ExerciseRef) => void
  /** Returns the pending pick and clears it. */
  consumePendingPick: () => ExerciseRef | null
  /** Clears the form but leaves `pendingPick` for the picker. */
  reset: () => void
}

const EMPTY: FormDraft = {
  name: '',
  primaryMuscles: [],
  secondaryMuscles: [],
  notes: '',
}

const snapshot = (draft: FormDraft) => JSON.stringify(draft)

const INITIAL = {
  draft: EMPTY,
  baseline: snapshot(EMPTY),
  mode: null,
  editingId: null,
  pickOrigin: null,
} as const

function draftFromSource(from: ExerciseRef): FormDraft | undefined {
  if (from.source === 'db') {
    const exercise = getExerciseById(from.exerciseId)
    if (!exercise) return undefined
    return {
      name: exercise.name,
      primaryMuscles: [...exercise.primaryMuscles],
      secondaryMuscles: [...exercise.secondaryMuscles],
      equipmentTag: exercise.equipment,
      mechanic: exercise.mechanic,
      notes: '',
    }
  }
  const row = getCustomExercise(from.exerciseId)
  if (!row) return undefined
  return {
    name: row.name,
    primaryMuscles: [...row.primaryMuscles],
    secondaryMuscles: [...row.secondaryMuscles],
    equipmentTag: row.equipmentTag,
    mechanic: row.mechanic,
    notes: '',
  }
}

function initialDraft({ mode, name, from, editingId }: StartOptions): FormDraft {
  if (mode === 'edit' && editingId) {
    const row = getCustomExercise(editingId)
    if (row) {
      return {
        name: row.name,
        primaryMuscles: [...row.primaryMuscles],
        secondaryMuscles: [...row.secondaryMuscles],
        equipmentTag: row.equipmentTag,
        mechanic: row.mechanic,
        notes: row.notes ?? '',
      }
    }
  }
  if (mode === 'duplicate' && from) {
    const source = draftFromSource(from)
    if (source) return { ...source, name: `${source.name} copy` }
  }
  return { ...EMPTY, name: name ?? '' }
}

export const useCustomExerciseFormStore = create<FormState>()((set, get) => ({
  ...INITIAL,
  pendingPick: null,

  start(options) {
    const draft = initialDraft(options)
    set({
      draft,
      baseline: snapshot(draft),
      mode: options.mode,
      editingId: options.editingId ?? null,
      pickOrigin: options.pickOrigin ?? null,
    })
  },

  setName: (name) => set((s) => ({ draft: { ...s.draft, name } })),

  setPrimaryMuscles: (muscles) =>
    set((s) => ({
      draft: {
        ...s.draft,
        primaryMuscles: muscles,
        secondaryMuscles: s.draft.secondaryMuscles.filter((m) => !muscles.includes(m)),
      },
    })),

  setSecondaryMuscles: (muscles) =>
    set((s) => ({
      draft: {
        ...s.draft,
        secondaryMuscles: muscles.filter((m) => !s.draft.primaryMuscles.includes(m)),
      },
    })),

  setEquipmentTag: (equipmentTag) => set((s) => ({ draft: { ...s.draft, equipmentTag } })),
  setMechanic: (mechanic) => set((s) => ({ draft: { ...s.draft, mechanic } })),
  setNotes: (notes) => set((s) => ({ draft: { ...s.draft, notes } })),

  setPendingPick: (ref) => set({ pendingPick: ref }),
  consumePendingPick() {
    const ref = get().pendingPick
    if (ref) set({ pendingPick: null })
    return ref
  },

  reset: () => set({ ...INITIAL }),
}))

export const selectIsDirty = (state: FormState): boolean =>
  state.mode !== null && snapshot(state.draft) !== state.baseline
