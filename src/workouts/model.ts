import type { Set as SetRecord, TargetsSnapshot, Unit, Workout } from '@/db/types'
import { formatWeight, unitLabel } from '@/workouts/units'

/** Values every new or reset set starts from (RIR is always 0, never the target). */
export const BLANK_SET = { weight: 0, reps: 0, rir: 0, rirIsPlus: false } as const

export type Side = 'L' | 'R'

type Unilateral = NonNullable<SetRecord['unilateral']>
type SetLike = Pick<SetRecord, 'weight' | 'reps' | 'partialReps' | 'unilateral'>

/**
 * LOG-6: the one weight x reps an L/R set contributes to analytics. Heavier
 * side wins; on a weight tie the side with FEWER reps wins; on a full tie, L.
 */
export function unilateralAggregate(u: Unilateral): { weight: number; reps: number; side: Side } {
  const left = { weight: u.leftWeight, reps: u.leftReps, side: 'L' as const }
  const right = { weight: u.rightWeight, reps: u.rightReps, side: 'R' as const }
  if (left.weight !== right.weight) return left.weight > right.weight ? left : right
  return right.reps < left.reps ? right : left
}

const positive = (value: number | undefined) => (value && value > 0 ? value : undefined)

/** True when the two sides of an L/R set are not identical (weight, reps or partials). */
export function sidesDiffer(set: Pick<SetRecord, 'unilateral'>): boolean {
  const u = set.unilateral
  if (!u) return false
  return (
    u.leftWeight !== u.rightWeight ||
    u.leftReps !== u.rightReps ||
    (u.leftPartialReps ?? 0) !== (u.rightPartialReps ?? 0)
  )
}

/** Turns a normal set into an L/R set: both sides take the current values. */
export function toUnilateral<T extends SetLike>(set: T): T {
  const partial = positive(set.partialReps)
  const unilateral: Unilateral = {
    leftWeight: set.weight,
    leftReps: set.reps,
    rightWeight: set.weight,
    rightReps: set.reps,
  }
  if (partial) {
    unilateral.leftPartialReps = partial
    unilateral.rightPartialReps = partial
  }
  const next = { ...set, unilateral }
  delete next.partialReps
  return next
}

/** Merges an L/R set back to one line: the aggregate side's weight, reps and partials. */
export function fromUnilateral<T extends SetLike>(set: T): T {
  const u = set.unilateral
  if (!u) return set
  const { weight, reps, side } = unilateralAggregate(u)
  const partial = positive(side === 'L' ? u.leftPartialReps : u.rightPartialReps)
  const next = { ...set, weight, reps }
  delete next.unilateral
  if (partial) next.partialReps = partial
  else delete next.partialReps
  return next
}

/**
 * Pre-fill for working row `index` from last session's working sets: same
 * row, else its last row, else blank. The exercise is L/R when the first
 * previous row was (decision D); each row's sides come from its own row, and
 * a normal row puts its weight and reps on both sides. Partials never carry.
 */
export function prefillFor(
  previous: Pick<SetRecord, 'weight' | 'reps' | 'unilateral'>[],
  index: number,
): { weight: number; reps: number; unilateral?: Unilateral } {
  const source = previous[index] ?? previous[previous.length - 1]
  if (!source) return { weight: BLANK_SET.weight, reps: BLANK_SET.reps }
  if (!previous[0]?.unilateral) return { weight: source.weight, reps: source.reps }
  const u = source.unilateral ?? {
    leftWeight: source.weight,
    leftReps: source.reps,
    rightWeight: source.weight,
    rightReps: source.reps,
  }
  const unilateral: Unilateral = {
    leftWeight: u.leftWeight,
    leftReps: u.leftReps,
    rightWeight: u.rightWeight,
    rightReps: u.rightReps,
  }
  const { weight, reps } = unilateralAggregate(unilateral)
  return { weight, reps, unilateral }
}

/**
 * The fields of the next working set appended to an exercise (the "Add set"
 * rule). L/R mode follows the last row, else the same row of last session;
 * weight and reps come from that same previous row when it exists, else weight
 * from the last row and reps blank; RIR is copied from the last row.
 * `orderIndex` is the last live index + 1 (never the row count).
 */
export function nextSetFields(
  existing: SetRecord[],
  previous: SetRecord[],
): Pick<SetRecord, 'orderIndex' | 'type' | 'weight' | 'reps' | 'rir' | 'rirIsPlus' | 'unilateral'> {
  const last = existing[existing.length - 1]
  const sameRow = previous[existing.length]
  const unilateralMode = last ? last.unilateral != null : sameRow?.unilateral != null
  const rir = { rir: last?.rir ?? BLANK_SET.rir, rirIsPlus: last?.rirIsPlus ?? BLANK_SET.rirIsPlus }
  const orderIndex = last ? last.orderIndex + 1 : 0
  if (unilateralMode) {
    const sides = sameRow?.unilateral ?? {
      leftWeight: last?.unilateral?.leftWeight ?? last?.weight ?? BLANK_SET.weight,
      leftReps: 0,
      rightWeight: last?.unilateral?.rightWeight ?? last?.weight ?? BLANK_SET.weight,
      rightReps: 0,
    }
    const unilateral: Unilateral = {
      leftWeight: sides.leftWeight,
      leftReps: sides.leftReps,
      rightWeight: sides.rightWeight,
      rightReps: sides.rightReps,
    }
    const { weight, reps } = unilateralAggregate(unilateral)
    return { orderIndex, type: 'working', weight, reps, ...rir, unilateral }
  }
  return {
    orderIndex,
    type: 'working',
    weight: sameRow?.weight ?? last?.weight ?? BLANK_SET.weight,
    reps: sameRow?.reps ?? 0,
    ...rir,
  }
}

type WorkoutTiming =Pick<Workout, 'startedAt' | 'pausedAt' | 'pausedMs' | 'finishedAt'>

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
export function formatPrevious(
  set: Pick<SetRecord, 'weight' | 'reps' | 'partialReps' | 'rir' | 'rirIsPlus'>,
  unit: Unit,
): {
  text: string
  partial?: string
  rir: string
} {
  const { full, partial } = formatReps(set.reps, set.partialReps)
  return {
    text: `${formatWeight(set.weight, unit)} ${unitLabel(unit)} × ${full}`,
    partial,
    rir: `RIR ${rirLabel(set.rir, set.rirIsPlus)}`,
  }
}

/** "20 kg × 12" (+ partial part) for one side of an L/R set. */
export function formatSide(
  weight: number,
  reps: number,
  partial: number | undefined,
  unit: Unit,
): { text: string; partial?: string } {
  const parts = formatReps(reps, partial)
  return { text: `${formatWeight(weight, unit)} ${unitLabel(unit)} × ${parts.full}`, partial: parts.partial }
}

/** Per-side Previous / History parts for an L/R set; null for a normal set. */
export function formatSides(
  set: Pick<SetRecord, 'unilateral'>,
  unit: Unit,
): { side: Side; text: string; partial?: string }[] | null {
  const u = set.unilateral
  if (!u) return null
  return [
    { side: 'L', ...formatSide(u.leftWeight, u.leftReps, u.leftPartialReps, unit) },
    { side: 'R', ...formatSide(u.rightWeight, u.rightReps, u.rightPartialReps, unit) },
  ]
}

/** A set can be checked off only once it has a rep (both sides when L/R). */
export function canCheck(set: {
  reps: number
  unilateral?: Pick<Unilateral, 'leftReps' | 'rightReps'>
}): boolean {
  if (set.unilateral) return set.unilateral.leftReps >= 1 && set.unilateral.rightReps >= 1
  return set.reps >= 1
}

/** Where the pad opens when an incomplete set is checked: the first side missing reps. */
export function firstEmptyReps(set: { unilateral?: Pick<Unilateral, 'leftReps'> }): {
  field: 'reps'
  side?: Side
} {
  if (!set.unilateral) return { field: 'reps' }
  return { field: 'reps', side: set.unilateral.leftReps >= 1 ? 'R' : 'L' }
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
export type Cursor = { setId: string; field: PadField; side?: Side }

/**
 * Next-key order: weight -> reps -> next set's weight, and from the last set
 * of an exercise to the next exercise's first set. An L/R set runs
 * L weight -> L reps -> R weight -> R reps. Null at the very end.
 */
export function nextCursor(
  cursor: Cursor,
  exercises: { sets: { id: string; unilateral?: unknown }[] }[],
): Cursor | null {
  const all = exercises.flatMap((exercise) => exercise.sets)
  const index = all.findIndex((set) => set.id === cursor.setId)
  if (index >= 0 && all[index].unilateral) {
    const side = cursor.side ?? 'L'
    if (cursor.field === 'weight') return { setId: cursor.setId, field: 'reps', side }
    if (side === 'L') return { setId: cursor.setId, field: 'weight', side: 'R' }
  } else if (cursor.field === 'weight') {
    return { setId: cursor.setId, field: 'reps' }
  }
  const next = index >= 0 ? all[index + 1] : undefined
  if (!next) return null
  return next.unilateral
    ? { setId: next.id, field: 'weight', side: 'L' }
    : { setId: next.id, field: 'weight' }
}

/**
 * The pad's working buffer for the active set. Values are strings so a
 * half-typed "60." survives; `fresh` means the next digit replaces the value.
 */
export type PadEntry = {
  field: PadField
  side?: Side
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
  set: Pick<SetLike, 'weight' | 'reps' | 'partialReps'> & { unilateral?: Unilateral },
  field: PadField,
  side?: Side,
): PadEntry {
  const u = set.unilateral
  if (u && side) {
    const left = side === 'L'
    const partial = left ? u.leftPartialReps : u.rightPartialReps
    return {
      field,
      side,
      mode: 'F',
      fresh: true,
      weight: `${left ? u.leftWeight : u.rightWeight}`,
      reps: `${left ? u.leftReps : u.rightReps}`,
      partial: partial ? `${partial}` : '',
    }
  }
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

/**
 * The fields to write when the pad commits `entry` to `set`. An L/R set gets
 * its whole updated `unilateral` object plus the recomputed LOG-6 aggregate
 * and never a set-level `partialReps`; a normal set gets today's fields.
 */
export function applyEntry(
  set: Pick<SetLike, 'unilateral'>,
  entry: PadEntry,
): { weight: number; reps: number; partialReps?: number; unilateral?: Unilateral } {
  const values = padEntryValues(entry)
  if (!set.unilateral || !entry.side) return values
  const unilateral: Unilateral =
    entry.side === 'L'
      ? {
          ...set.unilateral,
          leftWeight: values.weight,
          leftReps: values.reps,
          leftPartialReps: values.partialReps,
        }
      : {
          ...set.unilateral,
          rightWeight: values.weight,
          rightReps: values.reps,
          rightPartialReps: values.partialReps,
        }
  if (unilateral.leftPartialReps === undefined) delete unilateral.leftPartialReps
  if (unilateral.rightPartialReps === undefined) delete unilateral.rightPartialReps
  const { weight, reps } = unilateralAggregate(unilateral)
  return { weight, reps, unilateral }
}
