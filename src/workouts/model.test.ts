import { describe, expect, it } from 'vitest'
import {
  applyPadKey,
  BLANK_SET,
  canCheck,
  formatPrevious,
  formatReps,
  nextCursor,
  nextIncompleteExercise,
  padEntryFor,
  padEntryValues,
  repPlaceholder,
  rirLabel,
  toTargetsSnapshot,
  type PadEntry,
  type PadKey,
} from '@/workouts/model'

function press(entry: PadEntry, ...keys: PadKey[]): PadEntry {
  return keys.reduce(applyPadKey, entry)
}

const weightEntry = (weight = 0) => padEntryFor({ weight, reps: 0 }, 'weight')
const repsEntry = (reps = 0, partialReps?: number) =>
  padEntryFor({ weight: 0, reps, partialReps }, 'reps')

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
    expect(formatPrevious({ weight: 60, reps: 8, rir: 1, rirIsPlus: false })).toEqual({
      text: '60 kg × 8',
      partial: undefined,
      rir: 'RIR 1',
    })
    expect(
      formatPrevious({ weight: 62.5, reps: 8, partialReps: 2, rir: 6, rirIsPlus: true }),
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
    const entry = padEntryFor({ weight: 62.5, reps: 8, partialReps: 2 }, 'reps')
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
