import { create } from 'zustand'
import { workouts } from '@/db/repos'
import { newId, now } from '@/db/ids'
import { LastExerciseError, type InsertPosition } from '@/db/repos/workoutExercises'
import { refKey } from '@/exercises/listing'
import type { ExerciseRef, Set as SetRecord, Unit, Workout } from '@/db/types'
import type { PadState, SessionExercise } from '@/stores/sessionStore'
import {
  BLANK_SET,
  applyEntry,
  applyPadKey,
  canCheck,
  nextCursor,
  nextSetFields,
  padEntryFor,
  prefillFor,
  type PadField,
  type PadKey,
  type Side,
} from '@/workouts/model'

/**
 * Edit store for a finished workout (LG-015). Memory only: nothing reaches
 * Dexie until `save()` hands the draft to `workouts.saveEdit`. It is
 * independent of `sessionStore`, so a past workout can be edited while
 * another one is in progress.
 */

type Draft = { workout: Workout; exercises: SessionExercise[] }

export type EditLoadResult = 'ready' | 'missing' | 'in_progress'

type EditState = {
  workoutId: string | null
  draft: Draft | null
  /** JSON of the draft when it was loaded. */
  baseline: string | null
  /** Previous sets keyed by workout exercise id (the session before this workout). */
  previousByExercise: Record<string, SetRecord[]>
  pad: PadState | null
  openSwipeSetId: string | null
  addSelection: ExerciseRef[]
  addPosition: InsertPosition
  saving: boolean
  error: string | null

  load: (id: string) => Promise<EditLoadResult>
  openPad: (setId: string, field: PadField, side: Side | undefined, unit: Unit) => void
  padKey: (key: PadKey) => void
  padNext: () => void
  closePad: () => void
  setRir: (setId: string, rir: number, rirIsPlus: boolean) => void
  addSet: (workoutExerciseId: string) => void
  removeSet: (setId: string) => void
  setSwipeOpen: (setId: string | null) => void
  /** Adds the exercises to the draft. Resolves true when they were added. */
  addExercises: (refs: ExerciseRef[], position: InsertPosition) => Promise<boolean>
  /** Removes an exercise from the draft. Throws LastExerciseError for the only one. */
  removeExercise: (workoutExerciseId: string) => void
  toggleAddPick: (ref: ExerciseRef) => void
  clearAddPicks: () => void
  setAddPosition: (position: InsertPosition) => void
  setExerciseNote: (workoutExerciseId: string, notes: string) => void
  setWorkoutNote: (notes: string) => void
  /** Writes the draft. Resolves true on success; on failure keeps the draft and sets `error`. */
  save: () => Promise<boolean>
  reset: () => void
}

const initial = {
  workoutId: null,
  draft: null,
  baseline: null,
  previousByExercise: {},
  pad: null,
  openSwipeSetId: null,
  addSelection: [],
  addPosition: { kind: 'end' },
  saving: false,
  error: null,
} satisfies Partial<EditState>

export const useWorkoutEditStore = create<EditState>((set, get) => {
  const mapExercises = (change: (exercises: SessionExercise[]) => SessionExercise[]) =>
    set((state) =>
      state.draft ? { draft: { ...state.draft, exercises: change(state.draft.exercises) } } : {},
    )

  const mapSets = (setId: string, change: (row: SetRecord) => SetRecord) =>
    mapExercises((exercises) =>
      exercises.map((entry) =>
        entry.sets.some((row) => row.id === setId)
          ? { ...entry, sets: entry.sets.map((row) => (row.id === setId ? change(row) : row)) }
          : entry,
      ),
    )

  const findSet = (setId: string) => {
    for (const entry of get().draft?.exercises ?? []) {
      const found = entry.sets.find((row) => row.id === setId)
      if (found) return found
    }
    return undefined
  }

  return {
    ...initial,

    async load(id) {
      if (get().workoutId === id && get().draft) return 'ready'
      const workout = await workouts.get(id)
      if (!workout || workout.status === 'discarded') return 'missing'
      if (workout.status === 'in_progress') return 'in_progress'
      const session = await workouts.loadSession(workout.id)
      if (!session) return 'missing'
      const previousByExercise: Record<string, SetRecord[]> = {}
      for (const entry of session.exercises) {
        previousByExercise[entry.exercise.id] = await workouts.previousSets(
          entry.exercise.exerciseRef,
          id,
          workout.startedAt,
        )
      }
      const draft: Draft = { workout: session.workout, exercises: session.exercises }
      set({ ...initial, workoutId: id, draft, baseline: JSON.stringify(draft), previousByExercise })
      return 'ready'
    },

    openPad(setId, field, side, unit) {
      const found = findSet(setId)
      if (!found) return
      const current = get().pad
      if (
        current &&
        current.setId === setId &&
        current.entry.field === field &&
        current.entry.side === side
      ) {
        return
      }
      set({ pad: { setId, entry: padEntryFor(found, field, side, unit) }, openSwipeSetId: null })
    },

    padKey(key) {
      const pad = get().pad
      if (!pad) return
      const entry = applyPadKey(pad.entry, key)
      if (entry === pad.entry) return
      const found = findSet(pad.setId)
      if (!found) return
      const fields = applyEntry(found, entry)
      set({ pad: { setId: pad.setId, entry } })
      mapSets(pad.setId, (row) => {
        const next = { ...row, ...fields }
        if ('partialReps' in fields && fields.partialReps === undefined) delete next.partialReps
        return next
      })
    },

    padNext() {
      const pad = get().pad
      const draft = get().draft
      if (!pad || !draft) return
      const next = nextCursor(
        { setId: pad.setId, field: pad.entry.field, side: pad.entry.side },
        draft.exercises,
      )
      set({ pad: null })
      if (next) get().openPad(next.setId, next.field, next.side, pad.entry.unit)
    },

    closePad() {
      set({ pad: null })
    },

    setRir(setId, rir, rirIsPlus) {
      mapSets(setId, (row) => ({ ...row, rir, rirIsPlus }))
    },

    addSet(workoutExerciseId) {
      const { draft, previousByExercise } = get()
      const entry = draft?.exercises.find((item) => item.exercise.id === workoutExerciseId)
      if (!entry) return
      const timestamp = now()
      const created: SetRecord = {
        id: newId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        workoutExerciseId,
        ...nextSetFields(entry.sets, previousByExercise[workoutExerciseId] ?? []),
      }
      mapExercises((exercises) =>
        exercises.map((item) =>
          item.exercise.id === workoutExerciseId ? { ...item, sets: [...item.sets, created] } : item,
        ),
      )
    },

    removeSet(setId) {
      mapExercises((exercises) =>
        exercises.map((entry) => ({ ...entry, sets: entry.sets.filter((row) => row.id !== setId) })),
      )
      set((state) => ({
        pad: state.pad?.setId === setId ? null : state.pad,
        openSwipeSetId: null,
      }))
    },

    setSwipeOpen(setId) {
      set({ openSwipeSetId: setId })
    },

    async addExercises(refs, position) {
      const { draft, workoutId } = get()
      if (!draft || !workoutId || refs.length === 0) return false
      const existing = draft.exercises
      const taken = new Set(existing.map((entry) => refKey(entry.exercise.exerciseRef)))
      const fresh = refs.filter((ref, i) => {
        const key = refKey(ref)
        return !taken.has(key) && refs.findIndex((other) => refKey(other) === key) === i
      })
      if (fresh.length === 0) return false

      const timestamp = now()
      const previousByExercise = { ...get().previousByExercise }
      const created: SessionExercise[] = []
      for (const exerciseRef of fresh) {
        const previous = await workouts.previousSets(exerciseRef, workoutId, draft.workout.startedAt)
        const exerciseId = newId()
        previousByExercise[exerciseId] = previous
        created.push({
          exercise: {
            id: exerciseId,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            workoutId,
            orderIndex: 0,
            exerciseRef,
          },
          sets: Array.from({ length: Math.max(previous.length, 1) }, (_, i) => ({
            id: newId(),
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            workoutExerciseId: exerciseId,
            orderIndex: i,
            type: 'working' as const,
            ...BLANK_SET,
            ...prefillFor(previous, i),
          })),
        })
      }

      const current = get().draft
      if (!current) return false
      let at = current.exercises.length
      if (position.kind === 'start') at = 0
      if (position.kind === 'after') {
        const anchor = current.exercises.findIndex(
          (entry) => entry.exercise.id === position.workoutExerciseId,
        )
        if (anchor >= 0) at = anchor + 1
      }
      const ordered = [...current.exercises.slice(0, at), ...created, ...current.exercises.slice(at)].map(
        (entry, index) => ({ ...entry, exercise: { ...entry.exercise, orderIndex: index } }),
      )
      set({
        draft: { ...current, exercises: ordered },
        previousByExercise,
        addSelection: [],
        addPosition: { kind: 'end' },
      })
      return true
    },

    removeExercise(workoutExerciseId) {
      const list = get().draft?.exercises ?? []
      const doomed = list.find((entry) => entry.exercise.id === workoutExerciseId)
      if (!doomed) return
      if (list.length <= 1) throw new LastExerciseError()
      const setIds = new Set(doomed.sets.map((row) => row.id))
      mapExercises((exercises) =>
        exercises
          .filter((entry) => entry.exercise.id !== workoutExerciseId)
          .map((entry, index) => ({ ...entry, exercise: { ...entry.exercise, orderIndex: index } })),
      )
      set((state) => ({
        pad: state.pad && setIds.has(state.pad.setId) ? null : state.pad,
        openSwipeSetId: null,
      }))
    },

    toggleAddPick(ref) {
      set(({ addSelection }) => ({
        addSelection: addSelection.some((r) => refKey(r) === refKey(ref))
          ? addSelection.filter((r) => refKey(r) !== refKey(ref))
          : [...addSelection, ref],
      }))
    },

    clearAddPicks() {
      set({ addSelection: [], addPosition: { kind: 'end' } })
    },

    setAddPosition(position) {
      set({ addPosition: position })
    },

    setExerciseNote(workoutExerciseId, notes) {
      mapExercises((exercises) =>
        exercises.map((entry) =>
          entry.exercise.id === workoutExerciseId
            ? { ...entry, exercise: { ...entry.exercise, notes } }
            : entry,
        ),
      )
    },

    setWorkoutNote(notes) {
      set((state) =>
        state.draft ? { draft: { ...state.draft, workout: { ...state.draft.workout, notes } } } : {},
      )
    },

    async save() {
      const { workoutId, draft } = get()
      if (!workoutId || !draft || get().saving) return false
      set({ saving: true, error: null })
      try {
        await workouts.saveEdit(workoutId, {
          notes: draft.workout.notes,
          exercises: draft.exercises,
        })
      } catch (error) {
        set({ saving: false, error: error instanceof Error ? error.message : 'Could not save' })
        return false
      }
      get().reset()
      return true
    },

    reset() {
      set({ ...initial })
    },
  }
})

/** True when the draft differs from what was loaded (pad and swipe state excluded). */
export const selectIsDirty = (state: Pick<EditState, 'draft' | 'baseline'>): boolean =>
  state.draft != null && JSON.stringify(state.draft) !== state.baseline

/** Draft sets that would be dropped on save because they have no reps. */
export const selectEmptySetCount = (state: Pick<EditState, 'draft'>): number =>
  (state.draft?.exercises ?? []).reduce(
    (count, entry) => count + entry.sets.filter((row) => !canCheck(row)).length,
    0,
  )
