import type { Set as SetRecord, TargetsSnapshot, Workout } from '@/db/types'

/** Values every new or reset set starts from (RIR is always 0, never the target). */
export const BLANK_SET = { weight: 0, reps: 0, rir: 0, rirIsPlus: false } as const

type WorkoutTiming = Pick<Workout, 'startedAt' | 'pausedAt' | 'pausedMs' | 'finishedAt'>

/** True while the workout clock is frozen. */
export function isPaused(workout: Pick<Workout, 'pausedAt'>): boolean {
  return workout.pausedAt != null
}

/**
 * Active workout time in ms: wall time minus paused time. EVERY workout
 * duration (session top bar, floating bar, and future history/summary
 * screens) must use this instead of subtracting `startedAt` directly.
 */
export function workoutElapsedMs(workout: WorkoutTiming, now: number): number {
  const end = workout.finishedAt ?? workout.pausedAt ?? now
  return Math.max(0, end - workout.startedAt - (workout.pausedMs ?? 0))
}

type SnapshotSource = TargetsSnapshot

/** Copies the target fields off a program exercise; absent fields stay absent. */
export function toTargetsSnapshot(source: SnapshotSource): TargetsSnapshot {
  const snapshot: TargetsSnapshot = {}
  if (source.workingSets !== undefined) snapshot.workingSets = source.workingSets
  if (source.repMin !== undefined) snapshot.repMin = source.repMin
  if (source.repMax !== undefined) snapshot.repMax = source.repMax
  if (source.rirTarget !== undefined) snapshot.rirTarget = source.rirTarget
  if (source.restSeconds !== undefined) snapshot.restSeconds = source.restSeconds
  if (source.warmupSetCount !== undefined) snapshot.warmupSetCount = source.warmupSetCount
  if (source.notes !== undefined) snapshot.notes = source.notes
  return snapshot
}

/** Rep-range placeholder for an unfilled reps cell: "8–10", "8" or "". */
export function repPlaceholder(snapshot: TargetsSnapshot | undefined): string {
  if (!snapshot || snapshot.repMin === undefined || snapshot.repMax === undefined) return ''
  return snapshot.repMin === snapshot.repMax
    ? `${snapshot.repMin}`
    : `${snapshot.repMin}–${snapshot.repMax}`
}

/** Splits a reps cell into its parts so the UI can draw the muted divider. */
export function formatReps(
  reps: number,
  partialReps?: number,
): { full: string; partial?: string } {
  const full = `${reps}`
  return partialReps && partialReps > 0 ? { full, partial: `${partialReps}` } : { full }
}

export function rirLabel(rir: number, rirIsPlus: boolean): string {
  return rirIsPlus ? '6+' : `${rir}`
}

/** "60 kg × 8" (+ partial part) with its RIR line, for the read-only Previous column. */
export function formatPrevious(set: Pick<SetRecord, 'weight' | 'reps' | 'partialReps' | 'rir' | 'rirIsPlus'>): {
  text: string
  partial?: string
  rir: string
} {
  const { full, partial } = formatReps(set.reps, set.partialReps)
  return {
    text: `${set.weight} kg × ${full}`,
    partial,
    rir: `RIR ${rirLabel(set.rir, set.rirIsPlus)}`,
  }
}

/** A set can be checked off only once it has at least one rep. */
export function canCheck(set: { reps: number }): boolean {
  return set.reps >= 1
}

/**
 * Which exercise to focus after a set is checked. Only when the current
 * exercise has no unchecked set left: the next exercise that still has one,
 * else (wrapping) the first earlier one that does. Null means stay put,
 * including when every exercise is complete.
 */
export function nextIncompleteExercise(
  exercises: { id: string; sets: { completedAt?: number }[] }[],
  currentId: string,
): string | null {
  const index = exercises.findIndex((entry) => entry.id === currentId)
  if (index < 0) return null
  const incomplete = (entry: { sets: { completedAt?: number }[] }) =>
    entry.sets.some((set) => set.completedAt == null)
  if (incomplete(exercises[index])) return null
  const order = [...exercises.slice(index + 1), ...exercises.slice(0, index)]
  return order.find(incomplete)?.id ?? null
}

export type PadField = 'weight' | 'reps'
export type PadMode = 'F' | 'P'
export type Cursor = { setId: string; field: PadField }

/**
 * Next-key order: weight -> reps -> next set's weight, and from the last set
 * of an exercise to the next exercise's first set. Null at the very end.
 */
export function nextCursor(
  cursor: Cursor,
  exercises: { sets: { id: string }[] }[],
): Cursor | null {
  if (cursor.field === 'weight') return { setId: cursor.setId, field: 'reps' }
  const flat = exercises.flatMap((exercise) => exercise.sets.map((set) => set.id))
  const index = flat.indexOf(cursor.setId)
  const next = index >= 0 ? flat[index + 1] : undefined
  return next ? { setId: next, field: 'weight' } : null
}

/**
 * The pad's working buffer for the active set. Values are strings so a
 * half-typed "60." survives; `fresh` means the next digit replaces the value.
 */
export type PadEntry = {
  field: PadField
  mode: PadMode
  fresh: boolean
  weight: string
  reps: string
  partial: string
}

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back' | 'fp'

export const WEIGHT_MAX_LENGTH = 6
export const REPS_MAX_LENGTH = 3

export function padEntryFor(
  set: { weight: number; reps: number; partialReps?: number },
  field: PadField,
): PadEntry {
  return {
    field,
    mode: 'F',
    fresh: true,
    weight: `${set.weight}`,
    reps: `${set.reps}`,
    partial: set.partialReps ? `${set.partialReps}` : '',
  }
}

function targetOf(entry: PadEntry): 'weight' | 'reps' | 'partial' {
  if (entry.field === 'weight') return 'weight'
  return entry.mode === 'P' ? 'partial' : 'reps'
}

export function applyPadKey(entry: PadEntry, key: PadKey): PadEntry {
  if (key === 'fp') {
    if (entry.field !== 'reps') return entry
    return { ...entry, mode: entry.mode === 'F' ? 'P' : 'F', fresh: true }
  }

  const target = targetOf(entry)
  const current = entry.fresh ? '' : entry[target]
  const max = target === 'weight' ? WEIGHT_MAX_LENGTH : REPS_MAX_LENGTH

  if (key === 'back') {
    if (target === 'partial' && entry.partial === '' && !entry.fresh) {
      // Nothing left to clear: fall back to editing full reps.
      return { ...entry, mode: 'F', fresh: false, reps: entry.reps.slice(0, -1) }
    }
    return { ...entry, fresh: false, [target]: current.slice(0, -1) }
  }

  if (key === '.') {
    if (target !== 'weight' || current.includes('.')) return entry
    const next = current === '' ? '0.' : `${current}.`
    return next.length > max ? entry : { ...entry, fresh: false, weight: next }
  }

  const base = current === '0' ? '' : current
  const next = `${base}${key}`
  if (next.length > max) return entry
  return { ...entry, fresh: false, [target]: next }
}

/** Numeric values a pad entry commits to a set. Zero partials mean "none". */
export function padEntryValues(entry: PadEntry): {
  weight: number
  reps: number
  partialReps: number | undefined
} {
  const partial = Number(entry.partial || 0)
  return {
    weight: Number(entry.weight || 0),
    reps: Number(entry.reps || 0),
    partialReps: partial > 0 ? partial : undefined,
  }
}
