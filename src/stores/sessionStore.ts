import { create } from 'zustand'
import { sets, workoutExercises, workouts } from '@/db/repos'
import type { SetFields } from '@/db/repos/sets'
import { LastExerciseError, type InsertPosition, type SwapMode } from '@/db/repos/workoutExercises'
import { refKey } from '@/exercises/listing'
import type { ExerciseRef, Set as SetRecord, Workout, WorkoutExercise } from '@/db/types'
import { useRestTimerStore } from '@/stores/restTimerStore'
import {
  applyEntry,
  applyPadKey,
  canCheck,
  firstEmptyReps,
  fromUnilateral,
  nextCursor,
  nextIncompleteExercise,
  padEntryFor,
  toUnilateral,
  type PadEntry,
  type PadField,
  type PadKey,
  type Side,
} from '@/workouts/model'

/**
 * Live-workout session store (write-through). Actions update memory
 * synchronously so every key press shows instantly, then persist through the
 * repos in the background. Writes run through one queue so they land in the
 * order they were made. Dexie stays the source of truth: a failed write sets
 * `error` and reloads the session from it.
 */

export type SessionExercise = { exercise: WorkoutExercise; sets: SetRecord[] }

export type PadState = { setId: string; entry: PadEntry }

type SessionState = {
  workout: Workout | null
  exercises: SessionExercise[]
  focusedExerciseId: string | null
  pad: PadState | null
  openSwipeSetId: string | null
  /** Previous sets keyed by workout exercise id. */
  previousByExercise: Record<string, SetRecord[]>
  /** True once hydrate() has settled, with or without a workout. */
  hydrated: boolean
  hydratedWorkoutId: string | null
  error: string | null
  /** Exercises picked on the add picker, in pick order. Memory only. */
  addSelection: ExerciseRef[]
  addPosition: InsertPosition

  hydrate: () => Promise<void>
  start: (programId: string, dayId: string) => Promise<string>
  focusExercise: (workoutExerciseId: string) => void
  openPad: (setId: string, field: PadField, side?: Side) => void
  padKey: (key: PadKey) => void
  padNext: () => void
  closePad: () => void
  setRir: (setId: string, rir: number, rirIsPlus: boolean) => void
  toggleComplete: (setId: string) => void
  addSet: (workoutExerciseId: string) => Promise<void>
  /** Switches every set of the exercise to or from L/R (the exercise-level chip). */
  setUnilateral: (workoutExerciseId: string, on: boolean) => void
  removeSet: (setId: string) => void
  setSwipeOpen: (setId: string | null) => void
  swap: (workoutExerciseId: string, newRef: ExerciseRef, mode: SwapMode) => Promise<void>
  toggleAddPick: (ref: ExerciseRef) => void
  clearAddPicks: () => void
  setAddPosition: (position: InsertPosition) => void
  /** Adds the exercises to the workout. Resolves true when they were added. */
  addExercises: (refs: ExerciseRef[], position: InsertPosition) => Promise<boolean>
  /** Removes an exercise from this workout. Rejects with LastExerciseError for the only one. */
  removeExercise: (workoutExerciseId: string) => Promise<void>
  setExerciseNote: (workoutExerciseId: string, notes: string) => void
  setWorkoutNote: (notes: string) => void
  flushNotes: () => Promise<void>
  /** Starts every pending write right now (pagehide / tab hidden). Does not wait. */
  flushPending: () => void
  /** Freezes the workout clock. No-op when there is no workout or it is already paused. */
  pause: () => void
  /** Unfreezes the workout clock. No-op unless paused. */
  resume: () => void
  finish: () => Promise<void>
  discard: () => Promise<void>
  reset: () => void
}

const NOTE_DEBOUNCE_MS = 400

let queue: Promise<unknown> = Promise.resolve()
let inflightHydrate: Promise<void> | null = null
const pendingPatches = new Map<string, SetFields>()
const noteTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingNotes = new Map<string, string>()

const WORKOUT_NOTE_KEY = 'workout'

/**
 * Debounced notes are mirrored to localStorage synchronously. A reload can
 * cancel an in-flight IndexedDB write (the connection is force-closed), so the
 * journal is replayed on the next hydrate and dropped once the write lands.
 */
const NOTE_JOURNAL_KEY = 'ledger.pendingNotes'
type NoteJournal = { workoutId: string; notes: Record<string, string> }

function readNoteJournal(): NoteJournal | null {
  try {
    const raw = localStorage.getItem(NOTE_JOURNAL_KEY)
    return raw ? (JSON.parse(raw) as NoteJournal) : null
  } catch {
    return null
  }
}

function writeNoteJournal(journal: NoteJournal | null) {
  try {
    if (journal && Object.keys(journal.notes).length > 0) {
      localStorage.setItem(NOTE_JOURNAL_KEY, JSON.stringify(journal))
    } else localStorage.removeItem(NOTE_JOURNAL_KEY)
  } catch {
    // Storage can be blocked: the write-through path still runs.
  }
}

function journalNote(workoutId: string, key: string, value: string) {
  const current = readNoteJournal()
  const notes = current?.workoutId === workoutId ? current.notes : {}
  writeNoteJournal({ workoutId, notes: { ...notes, [key]: value } })
}

function unjournalNote(key: string, value: string) {
  const current = readNoteJournal()
  if (!current || current.notes[key] !== value) return
  const { [key]: _done, ...rest } = current.notes
  writeNoteJournal({ workoutId: current.workoutId, notes: rest })
}

const initial = {
  workout: null,
  exercises: [],
  focusedExerciseId: null,
  pad: null,
  openSwipeSetId: null,
  previousByExercise: {},
  hydrated: false,
  hydratedWorkoutId: null,
  error: null,
  addSelection: [],
  addPosition: { kind: 'end' },
} satisfies Partial<SessionState>

function clearNoteState() {
  for (const timer of noteTimers.values()) clearTimeout(timer)
  noteTimers.clear()
  pendingNotes.clear()
  pendingPatches.clear()
}

export const useSessionStore = create<SessionState>((set, get) => {
  const mapSets = (setId: string, change: (row: SetRecord) => SetRecord) =>
    set((state) => ({
      exercises: state.exercises.map((entry) =>
        entry.sets.some((row) => row.id === setId)
          ? { ...entry, sets: entry.sets.map((row) => (row.id === setId ? change(row) : row)) }
          : entry,
      ),
    }))

  const findSet = (setId: string) => {
    for (const entry of get().exercises) {
      const found = entry.sets.find((row) => row.id === setId)
      if (found) return { entry, set: found }
    }
    return undefined
  }

  /** Runs a persistence task after every earlier one; failures reload from Dexie. */
  const enqueue = (task: () => Promise<unknown>): Promise<void> => {
    const run = queue.then(task).then(
      () => undefined,
      async (error: unknown) => {
        set({ error: error instanceof Error ? error.message : 'Could not save' })
        await refresh()
      },
    )
    queue = run
    return run
  }

  // Invariant: Dexie writes for sets are always derived from in-memory rows, never re-derived from Dexie.
  const takePending = (include: (setId: string) => boolean = () => true) => {
    const entries: Array<[string, SetFields]> = []
    for (const [setId, patch] of [...pendingPatches.entries()]) {
      if (!include(setId)) continue
      pendingPatches.delete(setId)
      entries.push([setId, patch])
    }
    return entries
  }

  const schedulePatch = (setId: string, fields: SetFields) => {
    // Shallow merge by field: a `unilateral` in `fields` replaces the earlier object whole.
    pendingPatches.set(setId, { ...pendingPatches.get(setId), ...fields })
    void enqueue(async () => {
      // Empty when a flush or an L/R toggle task already wrote this entry.
      await sets.patchMany(takePending((id) => id === setId))
    })
  }

  async function loadPrevious(entries: SessionExercise[], workoutId: string) {
    const previous: Record<string, SetRecord[]> = {}
    for (const entry of entries) {
      previous[entry.exercise.id] = await workouts.previousSets(entry.exercise.exerciseRef, workoutId)
    }
    return previous
  }

  /** Applies notes a reload kept from reaching IndexedDB, then clears the journal. */
  async function replayNoteJournal(workoutId: string | undefined) {
    const journal = readNoteJournal()
    if (!journal) return
    writeNoteJournal(null)
    if (!workoutId || journal.workoutId !== workoutId) return
    for (const [key, value] of Object.entries(journal.notes)) {
      if (key === WORKOUT_NOTE_KEY) await workouts.setNotes(workoutId, value)
      else await workoutExercises.setNotes(key, value)
    }
  }

  /** Re-reads the in-progress workout from Dexie, keeping focus where possible. */
  async function refresh() {
    const workout = await workouts.getInProgress()
    if (!workout) {
      set({ ...initial, hydrated: true })
      return
    }
    const session = await workouts.loadSession(workout.id)
    if (!session) {
      set({ ...initial, hydrated: true })
      return
    }
    const previousByExercise = await loadPrevious(session.exercises, workout.id)
    const focused = get().focusedExerciseId
    const sameWorkout = get().hydratedWorkoutId === workout.id
    set({
      ...(sameWorkout ? {} : { addSelection: [], addPosition: { kind: 'end' } as InsertPosition }),
      workout: session.workout,
      exercises: session.exercises,
      previousByExercise,
      focusedExerciseId: session.exercises.some((entry) => entry.exercise.id === focused)
        ? focused
        : (session.exercises[0]?.exercise.id ?? null),
      hydrated: true,
      hydratedWorkoutId: workout.id,
      pad: null,
      openSwipeSetId: null,
    })
  }

  const writeNote = (key: string, notes: string) => {
    void enqueue(() =>
      key === WORKOUT_NOTE_KEY ? workouts.setNotes(get().workout!.id, notes) : workoutExercises.setNotes(key, notes),
    ).then(() => {
      if (!pendingNotes.has(key)) unjournalNote(key, notes)
    })
  }

  const scheduleNote = (key: string, notes: string) => {
    pendingNotes.set(key, notes)
    const workoutId = get().workout?.id
    if (workoutId) journalNote(workoutId, key, notes)
    clearTimeout(noteTimers.get(key))
    noteTimers.set(
      key,
      setTimeout(() => {
        noteTimers.delete(key)
        const value = pendingNotes.get(key)
        pendingNotes.delete(key)
        if (value !== undefined) writeNote(key, value)
      }, NOTE_DEBOUNCE_MS),
    )
  }

  const flushNotes = async () => {
    for (const [key, value] of [...pendingNotes.entries()]) {
      clearTimeout(noteTimers.get(key))
      noteTimers.delete(key)
      pendingNotes.delete(key)
      writeNote(key, value)
    }
    await queue
  }

  /**
   * The page may be gone in milliseconds: hand pending set patches and
   * debounced notes to IndexedDB immediately instead of waiting for the queue
   * or the 400ms debounce. Coalesced patches taken here make their queued
   * tasks no-ops; IndexedDB keeps same-store transactions in creation order.
   */
  const flushPending = () => {
    const entries = takePending()
    if (entries.length > 0) void sets.patchMany(entries).catch(() => {})
    for (const [key, value] of [...pendingNotes.entries()]) {
      clearTimeout(noteTimers.get(key))
      noteTimers.delete(key)
      pendingNotes.delete(key)
      const workout = get().workout
      if (key === WORKOUT_NOTE_KEY) {
        if (workout) void workouts.setNotes(workout.id, value).catch(() => {})
      } else {
        void workoutExercises.setNotes(key, value).catch(() => {})
      }
    }
  }

  return {
    ...initial,

    hydrate() {
      if (inflightHydrate) return inflightHydrate
      inflightHydrate = (async () => {
        const workout = await workouts.getInProgress()
        if (workout && get().hydratedWorkoutId === workout.id) {
          set({ hydrated: true })
        } else {
          await replayNoteJournal(workout?.id)
          await refresh()
        }
        // A stored rest timer survives a reload only for the workout it belongs to.
        useRestTimerStore.getState().reconcile(get().workout?.id ?? null)
      })().finally(() => {
        inflightHydrate = null
      })
      return inflightHydrate
    },

    async start(programId, dayId) {
      const id = await workouts.startFromProgramDay(programId, dayId)
      clearNoteState()
      writeNoteJournal(null)
      set({ ...initial })
      await refresh()
      return id
    },

    focusExercise(workoutExerciseId) {
      // The pad belongs to a set on screen: leaving its exercise closes it.
      const pad = get().pad
      const keep =
        pad &&
        get().exercises.some(
          (entry) =>
            entry.exercise.id === workoutExerciseId && entry.sets.some((row) => row.id === pad.setId),
        )
      set({ focusedExerciseId: workoutExerciseId, pad: keep ? pad : null, openSwipeSetId: null })
    },

    openPad(setId, field, side) {
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
      set({
        pad: { setId, entry: padEntryFor(found.set, field, side) },
        focusedExerciseId: found.entry.exercise.id,
        openSwipeSetId: null,
      })
    },

    padKey(key) {
      const pad = get().pad
      if (!pad) return
      const entry = applyPadKey(pad.entry, key)
      if (entry === pad.entry) return
      const found = findSet(pad.setId)
      if (!found) return
      const fields = applyEntry(found.set, entry)
      const uncheck = found.set.completedAt != null && !canCheck({ ...found.set, ...fields })
      set({ pad: { setId: pad.setId, entry } })
      mapSets(pad.setId, (row) => {
        const next = { ...row, ...fields }
        if (uncheck) delete next.completedAt
        return next
      })
      schedulePatch(pad.setId, fields)
      if (uncheck) void enqueue(() => sets.setCompleted(pad.setId, false))
    },

    padNext() {
      const pad = get().pad
      if (!pad) return
      const next = nextCursor(
        { setId: pad.setId, field: pad.entry.field, side: pad.entry.side },
        get().exercises,
      )
      if (!next) {
        set({ pad: null })
        return
      }
      set({ pad: null })
      get().openPad(next.setId, next.field, next.side)
    },

    closePad() {
      set({ pad: null })
    },

    setRir(setId, rir, rirIsPlus) {
      mapSets(setId, (row) => ({ ...row, rir, rirIsPlus }))
      schedulePatch(setId, { rir, rirIsPlus })
    },

    toggleComplete(setId) {
      const found = findSet(setId)
      if (!found) return
      if (found.set.completedAt != null) {
        mapSets(setId, (row) => {
          const next = { ...row }
          delete next.completedAt
          return next
        })
        void enqueue(() => sets.setCompleted(setId, false))
        return
      }
      if (!canCheck(found.set)) {
        const target = firstEmptyReps(found.set)
        get().openPad(setId, target.field, target.side)
        return
      }
      mapSets(setId, (row) => ({ ...row, completedAt: Date.now() }))
      void enqueue(() => sets.setCompleted(setId, true))
      // Checking a set is training: a paused workout clock starts again.
      get().resume()
      useRestTimerStore.getState().onSetCompleted(found.entry.exercise.id)
      // Checking the last set of an exercise moves on to the next one to do.
      const target = nextIncompleteExercise(
        get().exercises.map((entry) => ({ id: entry.exercise.id, sets: entry.sets })),
        found.entry.exercise.id,
      )
      if (target) set({ focusedExerciseId: target, pad: null, openSwipeSetId: null })
    },

    pause() {
      const workout = get().workout
      if (!workout || workout.pausedAt != null) return
      const at = Date.now()
      set({ workout: { ...workout, pausedAt: at } })
      void enqueue(() => workouts.pause(workout.id, at))
    },

    resume() {
      const workout = get().workout
      if (!workout || workout.pausedAt == null) return
      const at = Date.now()
      set({
        workout: {
          ...workout,
          pausedAt: null,
          pausedMs: (workout.pausedMs ?? 0) + Math.max(0, at - workout.pausedAt),
        },
      })
      void enqueue(() => workouts.resume(workout.id, at))
    },

    async addSet(workoutExerciseId) {
      await enqueue(async () => {
        const created = await sets.add(workoutExerciseId)
        set((state) => ({
          exercises: state.exercises.map((entry) =>
            entry.exercise.id === workoutExerciseId
              ? { ...entry, sets: [...entry.sets, created] }
              : entry,
          ),
        }))
      })
    },

    setUnilateral(workoutExerciseId, on) {
      const target = get().exercises.find((entry) => entry.exercise.id === workoutExerciseId)
      const convert = (row: SetRecord) =>
        (row.unilateral != null) === on ? row : on ? toUnilateral(row) : fromUnilateral(row)
      // The converted rows are the truth: schedule their logged fields as ordinary pending patches.
      for (const row of target?.sets ?? []) {
        const next = convert(row)
        if (next === row) continue
        pendingPatches.set(row.id, {
          ...pendingPatches.get(row.id),
          weight: next.weight,
          reps: next.reps,
          partialReps: next.partialReps,
          unilateral: next.unilateral,
        })
      }
      set((state) => ({
        exercises: state.exercises.map((entry) =>
          entry.exercise.id === workoutExerciseId
            ? {
                ...entry,
                sets: entry.sets.map(convert),
              }
            : entry,
        ),
        pad:
          state.pad &&
          state.exercises.some(
            (entry) =>
              entry.exercise.id === workoutExerciseId &&
              entry.sets.some((row) => row.id === state.pad?.setId),
          )
            ? null
            : state.pad,
        openSwipeSetId: null,
      }))
      if (target) {
        const ids = new Set(target.sets.map((row) => row.id))
        // One transaction for every pending entry of the exercise, so the toggle never lands half-applied.
        void enqueue(() => sets.patchMany(takePending((id) => ids.has(id))))
      }
    },

    removeSet(setId) {
      set((state) => ({
        exercises: state.exercises.map((entry) => ({
          ...entry,
          sets: entry.sets.filter((row) => row.id !== setId),
        })),
        pad: state.pad?.setId === setId ? null : state.pad,
        openSwipeSetId: null,
      }))
      pendingPatches.delete(setId)
      void enqueue(() => sets.softDelete(setId))
    },

    setSwipeOpen(setId) {
      set({ openSwipeSetId: setId })
    },

    async swap(workoutExerciseId, newRef, mode) {
      await enqueue(() => workoutExercises.swap(workoutExerciseId, newRef, mode))
      await refresh()
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

    async addExercises(refs, position) {
      const workoutId = get().workout?.id
      if (!workoutId) return false
      let ids: string[] | undefined
      await enqueue(async () => {
        ids = await workoutExercises.insert(workoutId, refs, position)
      })
      // On failure enqueue already reported the error and reloaded from Dexie.
      if (!ids) return false
      await refresh()
      set({ addSelection: [], addPosition: { kind: 'end' } })
      get().focusExercise(ids[0])
      return true
    },

    async removeExercise(workoutExerciseId) {
      const list = get().exercises
      const index = list.findIndex((entry) => entry.exercise.id === workoutExerciseId)
      if (index < 0) return
      if (list.length <= 1) throw new LastExerciseError()

      const doomed = list[index]
      const setIds = new Set(doomed.sets.map((row) => row.id))
      for (const id of setIds) pendingPatches.delete(id)
      clearTimeout(noteTimers.get(workoutExerciseId))
      noteTimers.delete(workoutExerciseId)
      const note = pendingNotes.get(workoutExerciseId)
      pendingNotes.delete(workoutExerciseId)
      if (note !== undefined) unjournalNote(workoutExerciseId, note)

      const wasFocused = get().focusedExerciseId === workoutExerciseId
      const neighbour = list[index + 1] ?? list[index - 1]
      set((state) => ({
        exercises: state.exercises.filter((entry) => entry.exercise.id !== workoutExerciseId),
        focusedExerciseId: wasFocused ? neighbour.exercise.id : state.focusedExerciseId,
        pad: state.pad && setIds.has(state.pad.setId) ? null : state.pad,
        openSwipeSetId: null,
      }))
      await enqueue(() => workoutExercises.remove(workoutExerciseId))
      await refresh()
    },

    setExerciseNote(workoutExerciseId, notes) {
      set((state) => ({
        exercises: state.exercises.map((entry) =>
          entry.exercise.id === workoutExerciseId
            ? { ...entry, exercise: { ...entry.exercise, notes } }
            : entry,
        ),
      }))
      scheduleNote(workoutExerciseId, notes)
    },

    setWorkoutNote(notes) {
      set((state) => ({ workout: state.workout ? { ...state.workout, notes } : state.workout }))
      scheduleNote(WORKOUT_NOTE_KEY, notes)
    },

    flushNotes,
    flushPending,

    async finish() {
      const workout = get().workout
      if (!workout) return
      await flushNotes()
      await queue
      await workouts.finish(workout.id)
      clearNoteState()
      writeNoteJournal(null)
      useRestTimerStore.getState().clear()
      set({ ...initial, hydrated: true })
    },

    async discard() {
      const workout = get().workout
      if (!workout) return
      clearNoteState()
      await queue
      await workouts.discard(workout.id)
      writeNoteJournal(null)
      useRestTimerStore.getState().clear()
      set({ ...initial, hydrated: true })
    },

    reset() {
      clearNoteState()
      writeNoteJournal(null)
      useRestTimerStore.getState().clear()
      set({ ...initial })
    },
  }
})

// Persist the last edit if the app is closed, reloaded or backgrounded right after a tap.
if (typeof window !== 'undefined') {
  const flush = () => useSessionStore.getState().flushPending()
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
