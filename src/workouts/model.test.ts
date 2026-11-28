import { describe, expect, it } from 'vitest'
import {
  applyEntry,
  applyPadKey,
  BLANK_SET,
  canCheck,
  firstEmptyReps,
  formatPrevious,
  formatSide,
  formatSides,
  fromUnilateral,
  formatReps,
  isPaused,
  nextCursor,
  nextIncompleteExercise,
  padEntryFor,
  padEntryValues,
  prefillFor,
  repPlaceholder,
  rirLabel,
  sidesDiffer,
  toUnilateral,
  unilateralAggregate,
  toTargetsSnapshot,
  workoutElapsedMs,
  type PadEntry,
  type PadKey,
} from '@/workouts/model'

function press(entry: PadEntry, ...keys: PadKey[]): PadEntry {
  return keys.reduce(applyPadKey, entry)
}

const weightEntry = (weight = 0) => padEntryFor({ weight, reps: 0 }, 'weight', undefined, 'kg')
const repsEntry = (reps = 0, partialReps?: number) =>
  padEntryFor({ weight: 0, reps, partialReps }, 'reps', undefined, 'kg')

describe('toTargetsSnapshot', () => {
  it('copies only the defined target fields', () => {
    expect(
      toTargetsSnapshot({ workingSets: 3, repMin: 8, repMax: 10, rirTarget: 1, restSeconds: 90 }),
    ).toEqual({ workingSets: 3, repMin: 8, repMax: 10, rirTarget: 1, restSeconds: 90 })
  })

  it('returns an empty snapshot for a program exercise with no targets', () => {
    expect(toTargetsSnapshot({})).toEqual({})
  })

  it('keeps warm-up count and notes', () => {
    expect(toTargetsSnapshot({ warmupSetCount: 2, notes: 'Pause' })).toEqual({
      warmupSetCount: 2,
      notes: 'Pause',
    })
  })
})

describe('blank set', () => {
  it('is weight 0, reps 0, RIR 0, not plus', () => {
    expect(BLANK_SET).toEqual({ weight: 0, reps: 0, rir: 0, rirIsPlus: false })
  })
})

describe('prefillFor', () => {
  const previous = [
    { weight: 100, reps: 8 },
    { weight: 90, reps: 6 },
  ]

  it('maps each row to the same row of last session', () => {
    expect(prefillFor(previous, 0)).toEqual({ weight: 100, reps: 8 })
    expect(prefillFor(previous, 1)).toEqual({ weight: 90, reps: 6 })
  })

  it('falls back to the last row for an index past the end', () => {
    expect(prefillFor(previous, 2)).toEqual({ weight: 90, reps: 6 })
  })

  it('is blank when there is no history', () => {
    expect(prefillFor([], 0)).toEqual({ weight: 0, reps: 0 })
  })

  it('never returns rir or partial reps', () => {
    const rich = [{ weight: 100, reps: 8, rir: 2, rirIsPlus: true, partialReps: 3 }]
    expect(prefillFor(rich, 0)).toEqual({ weight: 100, reps: 8 })
  })
})

describe('repPlaceholder', () => {
  it('renders a range, a single value or nothing', () => {
    expect(repPlaceholder({ repMin: 8, repMax: 10 })).toBe('8–10')
    expect(repPlaceholder({ repMin: 8, repMax: 8 })).toBe('8')
    expect(repPlaceholder({})).toBe('')
    expect(repPlaceholder(undefined)).toBe('')
  })
})

describe('formatReps / formatPrevious / rirLabel', () => {
  it('splits partials only when present', () => {
    expect(formatReps(8)).toEqual({ full: '8' })
    expect(formatReps(8, 0)).toEqual({ full: '8' })
    expect(formatReps(8, 2)).toEqual({ full: '8', partial: '2' })
  })

  it('labels RIR 6+ distinctly', () => {
    expect(rirLabel(3, false)).toBe('3')
    expect(rirLabel(6, true)).toBe('6+')
  })

  it('formats previous sets with and without partials', () => {
    expect(formatPrevious({ weight: 60, reps: 8, rir: 1, rirIsPlus: false }, 'kg')).toEqual({
      text: '60 kg × 8',
      partial: undefined,
      rir: 'RIR 1',
    })
    expect(
      formatPrevious({ weight: 62.5, reps: 8, partialReps: 2, rir: 6, rirIsPlus: true }, 'kg'),
    ).toEqual({ text: '62.5 kg × 8', partial: '2', rir: 'RIR 6+' })
  })
})

describe('canCheck', () => {
  it('needs at least one rep', () => {
    expect(canCheck({ reps: 0 })).toBe(false)
    expect(canCheck({ reps: 1 })).toBe(true)
  })
})

describe('nextCursor', () => {
  const exercises = [{ sets: [{ id: 'a' }, { id: 'b' }] }, { sets: [] }, { sets: [{ id: 'c' }] }]

  it('goes weight to reps on the same set', () => {
    expect(nextCursor({ setId: 'a', field: 'weight' }, exercises)).toEqual({
      setId: 'a',
      field: 'reps',
    })
  })

  it('goes reps to the next set weight', () => {
    expect(nextCursor({ setId: 'a', field: 'reps' }, exercises)).toEqual({
      setId: 'b',
      field: 'weight',
    })
  })

  it('crosses to the next exercise, skipping empty ones', () => {
    expect(nextCursor({ setId: 'b', field: 'reps' }, exercises)).toEqual({
      setId: 'c',
      field: 'weight',
    })
  })

  it('ends after the last set', () => {
    expect(nextCursor({ setId: 'c', field: 'reps' }, exercises)).toBeNull()
  })
})

describe('applyPadKey', () => {
  it('replaces the value on the first key, then appends', () => {
    const entry = weightEntry(60)
    expect(press(entry, '1').weight).toBe('1')
    expect(press(entry, '1', '2', '5').weight).toBe('125')
  })

  it('replaces a leading zero', () => {
    expect(press(weightEntry(), '0', '5').weight).toBe('5')
  })

  it('allows one decimal on weight only', () => {
    expect(press(weightEntry(), '6', '2', '.', '5').weight).toBe('62.5')
    expect(press(weightEntry(), '6', '.', '5', '.', '5').weight).toBe('6.55')
    expect(press(weightEntry(), '.').weight).toBe('0.')
    expect(press(repsEntry(), '.').reps).toBe('0')
  })

  it('caps weight at 6 characters and reps at 3', () => {
    expect(press(weightEntry(), '1', '2', '3', '4', '5', '6', '7').weight).toBe('123456')
    expect(press(repsEntry(), '1', '2', '3', '4').reps).toBe('123')
  })

  it('backspace deletes the last character and clears a fresh value', () => {
    expect(press(weightEntry(), '1', '2', 'back').weight).toBe('1')
    expect(press(weightEntry(60), 'back').weight).toBe('')
  })

  it('fp only toggles on the reps field', () => {
    expect(press(weightEntry(), 'fp').mode).toBe('F')
    const toggled = press(repsEntry(), 'fp')
    expect(toggled.mode).toBe('P')
    expect(press(toggled, 'fp').mode).toBe('F')
  })

  it('edits partials in P mode without touching reps', () => {
    const entry = press(repsEntry(), '8', 'fp', '2')
    expect(entry.reps).toBe('8')
    expect(entry.partial).toBe('2')
    expect(padEntryValues(entry)).toEqual({ weight: 0, reps: 8, partialReps: 2 })
  })

  it('first press after toggling replaces the existing partial', () => {
    const entry = press(repsEntry(8, 5), 'fp', '3')
    expect(entry.partial).toBe('3')
  })

  it('backspace in P mode clears partials first, then edits reps', () => {
    let entry = press(repsEntry(), '8', 'fp', '1', '2')
    entry = press(entry, 'back')
    expect(entry.partial).toBe('1')
    entry = press(entry, 'back')
    expect(entry.partial).toBe('')
    expect(entry.mode).toBe('P')
    entry = press(entry, 'back')
    expect(entry.mode).toBe('F')
    expect(entry.reps).toBe('')
  })

  it('a zero partial means no partials', () => {
    expect(padEntryValues(press(repsEntry(), '8', 'fp', '0')).partialReps).toBeUndefined()
  })

  it('padEntryFor seeds from the set and starts fresh in F mode', () => {
    const entry = padEntryFor({ weight: 62.5, reps: 8, partialReps: 2 }, 'reps', undefined, 'kg')
    expect(entry).toMatchObject({ weight: '62.5', reps: '8', partial: '2', mode: 'F', fresh: true })
  })
})

describe('nextIncompleteExercise', () => {
  const done = { completedAt: 1 }
  const todo = {}
  const ex = (id: string, ...sets: { completedAt?: number }[]) => ({ id, sets })

  it('stays put while the current exercise still has an unchecked set', () => {
    expect(nextIncompleteExercise([ex('a', done, todo), ex('b', todo)], 'a')).toBeNull()
  })

  it('moves to the next exercise that still has an unchecked set', () => {
    expect(nextIncompleteExercise([ex('a', done), ex('b', done), ex('c', todo)], 'a')).toBe('c')
    expect(nextIncompleteExercise([ex('a', done), ex('b', todo), ex('c', todo)], 'a')).toBe('b')
  })

  it('wraps to the first incomplete exercise when every later one is done', () => {
    expect(nextIncompleteExercise([ex('a', todo), ex('b', done), ex('c', done)], 'c')).toBe('a')
    expect(
      nextIncompleteExercise([ex('a', done), ex('b', todo), ex('c', done)], 'c'),
    ).toBe('b')
  })

  it('stays put when every exercise is complete', () => {
    expect(nextIncompleteExercise([ex('a', done), ex('b', done)], 'b')).toBeNull()
    expect(nextIncompleteExercise([ex('a', done)], 'a')).toBeNull()
  })

  it('ignores an unknown id', () => {
    expect(nextIncompleteExercise([ex('a', todo)], 'zzz')).toBeNull()
  })
})

describe('workoutElapsedMs', () => {
  it('counts wall time while running', () => {
    expect(workoutElapsedMs({ startedAt: 1_000 }, 6_000)).toBe(5_000)
  })

  it('freezes at pausedAt while paused', () => {
    const paused = { startedAt: 1_000, pausedAt: 4_000 }
    expect(workoutElapsedMs(paused, 4_000)).toBe(3_000)
    expect(workoutElapsedMs(paused, 90_000)).toBe(3_000)
    expect(isPaused(paused)).toBe(true)
  })

  it('excludes closed pauses after resume', () => {
    const resumed = { startedAt: 1_000, pausedAt: null, pausedMs: 2_000 }
    expect(workoutElapsedMs(resumed, 11_000)).toBe(8_000)
    expect(isPaused(resumed)).toBe(false)
  })

  it('stops at finishedAt', () => {
    const done = { startedAt: 1_000, pausedMs: 2_000, finishedAt: 10_000 }
    expect(workoutElapsedMs(done, 999_999)).toBe(7_000)
  })

  it('is never negative', () => {
    expect(workoutElapsedMs({ startedAt: 5_000, pausedMs: 9_000 }, 6_000)).toBe(0)
    expect(workoutElapsedMs({ startedAt: 5_000 }, 1_000)).toBe(0)
  })
})

const sides = (leftWeight: number, leftReps: number, rightWeight: number, rightReps: number) => ({
  leftWeight,
  leftReps,
  rightWeight,
  rightReps,
})

describe('unilateralAggregate (LOG-6)', () => {
  it('counts the side with fewer reps on a weight tie: L 20x12 / R 20x10 -> 20x10', () => {
    expect(unilateralAggregate(sides(20, 12, 20, 10))).toEqual({ weight: 20, reps: 10, side: 'R' })
  })

  it('takes the heavier side: L 20x12 / R 22x10 -> 22x10', () => {
    expect(unilateralAggregate(sides(20, 12, 22, 10))).toEqual({ weight: 22, reps: 10, side: 'R' })
    expect(unilateralAggregate(sides(24, 8, 22, 10))).toEqual({ weight: 24, reps: 8, side: 'L' })
  })

  it('tie on weight and reps goes to L', () => {
    expect(unilateralAggregate(sides(20, 10, 20, 10))).toEqual({ weight: 20, reps: 10, side: 'L' })
  })
})

describe('sidesDiffer', () => {
  it('is false for a normal set and identical sides', () => {
    expect(sidesDiffer({})).toBe(false)
    expect(sidesDiffer({ unilateral: sides(20, 10, 20, 10) })).toBe(false)
  })

  it('is true when weight, reps or partials differ', () => {
    expect(sidesDiffer({ unilateral: sides(20, 10, 22, 10) })).toBe(true)
    expect(sidesDiffer({ unilateral: sides(20, 12, 20, 10) })).toBe(true)
    expect(sidesDiffer({ unilateral: { ...sides(20, 10, 20, 10), rightPartialReps: 2 } })).toBe(true)
  })
})

describe('toUnilateral / fromUnilateral', () => {
  it('puts the current values on both sides and clears set-level partials', () => {
    const set = toUnilateral({ weight: 20, reps: 10, partialReps: 2 })
    expect(set).toEqual({
      weight: 20,
      reps: 10,
      unilateral: { ...sides(20, 10, 20, 10), leftPartialReps: 2, rightPartialReps: 2 },
    })
    expect('partialReps' in set).toBe(false)
  })

  it('round-trips a normal set including partials', () => {
    const original = { weight: 20, reps: 10, partialReps: 2 }
    expect(fromUnilateral(toUnilateral(original))).toEqual(original)
    expect(fromUnilateral(toUnilateral({ weight: 20, reps: 10 }))).toEqual({ weight: 20, reps: 10 })
  })

  it('merges to the aggregate side and takes its partials', () => {
    const set = fromUnilateral({
      weight: 22,
      reps: 10,
      unilateral: { ...sides(20, 12, 22, 10), leftPartialReps: 3, rightPartialReps: 1 },
    })
    expect(set).toEqual({ weight: 22, reps: 10, partialReps: 1 })
    expect('unilateral' in set).toBe(false)
  })

  it('leaves a normal set untouched', () => {
    expect(fromUnilateral({ weight: 5, reps: 5 })).toEqual({ weight: 5, reps: 5 })
  })
})

describe('canCheck for L/R sets', () => {
  it('needs reps on both sides', () => {
    expect(canCheck({ reps: 10, unilateral: sides(20, 10, 20, 0) })).toBe(false)
    expect(canCheck({ reps: 0, unilateral: sides(20, 0, 20, 10) })).toBe(false)
    expect(canCheck({ reps: 10, unilateral: sides(20, 10, 20, 8) })).toBe(true)
  })
})

describe('firstEmptyReps', () => {
  it('points at the first side missing reps', () => {
    expect(firstEmptyReps({})).toEqual({ field: 'reps' })
    expect(firstEmptyReps({ unilateral: sides(20, 0, 20, 0) })).toEqual({ field: 'reps', side: 'L' })
    expect(firstEmptyReps({ unilateral: sides(20, 10, 20, 0) })).toEqual({ field: 'reps', side: 'R' })
  })
})

describe('formatSide / formatSides', () => {
  it('formats one side with and without a partial', () => {
    expect(formatSide(20, 12, undefined, 'kg')).toEqual({ text: '20 kg × 12', partial: undefined })
    expect(formatSide(22, 10, 2, 'kg')).toEqual({ text: '22 kg × 10', partial: '2' })
  })

  it('returns per-side parts for an L/R set and null otherwise', () => {
    expect(formatSides({}, 'kg')).toBeNull()
    expect(formatSides({ unilateral: { ...sides(20, 12, 22, 10), leftPartialReps: 2 } }, 'kg')).toEqual([
      { side: 'L', text: '20 kg × 12', partial: '2' },
      { side: 'R', text: '22 kg × 10', partial: undefined },
    ])
  })
})

describe('prefillFor with L/R history', () => {
  it('carries L/R and the aggregate, never partials', () => {
    const previous = [
      { weight: 20, reps: 10, unilateral: { ...sides(20, 12, 20, 10), leftPartialReps: 2 } },
      { weight: 22, reps: 8, unilateral: sides(22, 8, 20, 8) },
    ]
    expect(prefillFor(previous, 0)).toEqual({
      weight: 20,
      reps: 10,
      unilateral: sides(20, 12, 20, 10),
    })
    expect(prefillFor(previous, 5)).toEqual({ weight: 22, reps: 8, unilateral: sides(22, 8, 20, 8) })
  })

  it('puts a normal later row on both sides when the first row is L/R', () => {
    const previous = [
      { weight: 20, reps: 10, unilateral: sides(20, 10, 20, 10) },
      { weight: 18, reps: 9 },
    ]
    expect(prefillFor(previous, 1)).toEqual({
      weight: 18,
      reps: 9,
      unilateral: sides(18, 9, 18, 9),
    })
  })

  it('stays normal when the first row is normal', () => {
    const previous = [
      { weight: 20, reps: 10 },
      { weight: 20, reps: 8, unilateral: sides(20, 8, 20, 8) },
    ]
    expect(prefillFor(previous, 1)).toEqual({ weight: 20, reps: 8 })
  })
})

describe('L/R pad entry and cursor', () => {
  const set = {
    weight: 22,
    reps: 10,
    unilateral: { ...sides(20, 12, 22, 10), leftPartialReps: 2 },
  }

  it('reads the tapped side', () => {
    expect(padEntryFor(set, 'reps', 'L', 'kg')).toMatchObject({
      side: 'L',
      weight: '20',
      reps: '12',
      partial: '2',
    })
    expect(padEntryFor(set, 'weight', 'R', 'kg')).toMatchObject({
      side: 'R',
      weight: '22',
      reps: '10',
      partial: '',
    })
  })

  it('walks L kg, L reps, R kg, R reps, then the next set', () => {
    const exercises = [
      { sets: [{ id: 'a', unilateral: {} }, { id: 'b', unilateral: {} }] },
      { sets: [{ id: 'c' }] },
    ]
    const l1 = nextCursor({ setId: 'a', field: 'weight', side: 'L' }, exercises)
    expect(l1).toEqual({ setId: 'a', field: 'reps', side: 'L' })
    const r0 = nextCursor(l1!, exercises)
    expect(r0).toEqual({ setId: 'a', field: 'weight', side: 'R' })
    const r1 = nextCursor(r0!, exercises)
    expect(r1).toEqual({ setId: 'a', field: 'reps', side: 'R' })
    expect(nextCursor(r1!, exercises)).toEqual({ setId: 'b', field: 'weight', side: 'L' })
    expect(nextCursor({ setId: 'b', field: 'reps', side: 'R' }, exercises)).toEqual({
      setId: 'c',
      field: 'weight',
    })
  })

  it('ends after the last L/R set', () => {
    const exercises = [{ sets: [{ id: 'a', unilateral: {} }] }]
    expect(nextCursor({ setId: 'a', field: 'reps', side: 'R' }, exercises)).toBeNull()
  })
})

describe('applyEntry', () => {
  it('writes the normal fields for a normal set', () => {
    const entry = press(padEntryFor({ weight: 0, reps: 0 }, 'reps', undefined, 'kg'), '8')
    expect(applyEntry({}, entry)).toEqual({ reps: 8, partialReps: undefined })
  })

  it('writes the edited side and recomputes the aggregate as R passes L', () => {
    const base = { weight: 20, reps: 12, unilateral: sides(20, 12, 20, 12) }
    const entry = press(padEntryFor(base, 'weight', 'R', 'kg'), '2', '2')
    const out = applyEntry(base, entry)
    expect(out.unilateral).toEqual(sides(20, 12, 22, 12))
    expect(out).toMatchObject({ weight: 22, reps: 12 })
    expect(out.partialReps).toBeUndefined()
  })

  it('stores a per-side partial and never a set-level one', () => {
    const base = { weight: 20, reps: 10, unilateral: sides(20, 12, 20, 10) }
    const entry = press(padEntryFor(base, 'reps', 'L', 'kg'), 'fp', '3')
    const out = applyEntry(base, entry)
    expect(out.unilateral).toEqual({ ...sides(20, 12, 20, 10), leftPartialReps: 3 })
    expect(out.partialReps).toBeUndefined()
    expect(out).toMatchObject({ weight: 20, reps: 10 })
  })

  it('drops a cleared partial from the side', () => {
    const base = {
      weight: 20,
      reps: 10,
      unilateral: { ...sides(20, 12, 20, 10), leftPartialReps: 3 },
    }
    const entry = press(padEntryFor(base, 'reps', 'L', 'kg'), 'fp', 'back')
    expect(applyEntry(base, entry).unilateral).toEqual(sides(20, 12, 20, 10))
  })
})
