import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { getAllExercises } from '@/exercises/catalog'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import type { ProgramTree } from '@/db/repos/programs'
import {
  NEW_PROGRAM_NAME,
  countWorkouts,
  emptyDraft,
  exerciseName,
  firstIncompleteExercise,
  formatTargets,
  isDeletedExercise,
  hasRequiredTargets,
  dayAfter,
  isRestDay,
  nextDayName,
  normalizePass,
  passState,
  programTreeToDraft,
  restDigitsToSeconds,
  secondsToRestDigits,
} from '@/programs/model'

const base = { createdAt: 1, updatedAt: 1, deletedAt: null }

describe('programs model', () => {
  it('isRestDay is true only for a day with no exercises', () => {
    expect(isRestDay({ exercises: [] })).toBe(true)
    expect(isRestDay({ exercises: [{}] })).toBe(false)
  })

  it('countWorkouts skips rest days', () => {
    expect(countWorkouts([{ exercises: [1] }, { exercises: [] }, { exercises: [1, 2] }])).toBe(2)
  })

  it('nextDayName numbers by position', () => {
    expect(nextDayName([])).toBe('Day 1')
    expect(nextDayName([1, 2, 3])).toBe('Day 4')
  })

  it('emptyDraft has one Day 1 and is new', () => {
    const draft = emptyDraft()
    expect(draft.isNew).toBe(true)
    expect(draft.name).toBe(NEW_PROGRAM_NAME)
    expect(draft.isActive).toBe(false)
    expect(draft.days).toHaveLength(1)
    expect(draft.days[0]).toMatchObject({ name: 'Day 1', exercises: [] })
    expect(draft.id).toBeTruthy()
    expect(draft.days[0].id).toBeTruthy()
  })

  it('programTreeToDraft orders days and exercises by orderIndex and drops nothing', () => {
    const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })
    const tree: ProgramTree = {
      program: {
        ...base,
        id: 'p1',
        name: 'PPL',
        notes: 'n',
        isActive: true,
        isArchived: false,
        currentDayIndex: 0,
        currentCycleIndex: 0,
      },
      days: [
        {
          day: { ...base, id: 'd2', programId: 'p1', orderIndex: 1, name: 'Pull', notes: 'dn' },
          exercises: [],
        },
        {
          day: { ...base, id: 'd1', programId: 'p1', orderIndex: 0, name: 'Push' },
          exercises: [
            { ...base, id: 'e2', programDayId: 'd1', orderIndex: 1, exerciseRef: ref('b'), repMin: 5 },
            { ...base, id: 'e1', programDayId: 'd1', orderIndex: 0, exerciseRef: ref('a') },
          ],
        },
      ],
    }
    const draft = programTreeToDraft(tree)
    expect(draft).toMatchObject({ id: 'p1', isNew: false, name: 'PPL', notes: 'n', isActive: true })
    expect(draft.days.map((d) => d.id)).toEqual(['d1', 'd2'])
    expect(draft.days[1].notes).toBe('dn')
    expect(draft.days[0].exercises.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(draft.days[0].exercises[1].repMin).toBe(5)
    expect(draft.days[0].exercises[0].repMin).toBeUndefined()
  })

  it('exerciseName resolves a known catalog id and falls back otherwise', () => {
    const known = getAllExercises()[0]
    expect(exerciseName({ source: 'db', exerciseId: known.id })).toBe(known.name)
    expect(exerciseName({ source: 'db', exerciseId: 'nope' })).toBe('Custom exercise')
    expect(exerciseName({ source: 'custom', exerciseId: 'x' })).toBe('Custom exercise')
  })

  describe('custom refs', () => {
    beforeEach(async () => {
      await resetDb()
      useCustomExerciseStore.setState({ byId: {}, hydrated: false })
    })

    const input = {
      name: 'SSB Squat',
      primaryMuscles: ['quads' as const],
      secondaryMuscles: [],
    }

    it('exerciseName returns the real name of a live and of a deleted custom exercise', async () => {
      const store = useCustomExerciseStore.getState()
      const live = await store.create(input)
      const gone = await store.create({ ...input, name: 'Old Move' })
      await store.remove(gone.id)

      expect(exerciseName({ source: 'custom', exerciseId: live.id })).toBe('SSB Squat')
      expect(exerciseName({ source: 'custom', exerciseId: gone.id })).toBe('Old Move')
    })

    it('isDeletedExercise is true only for a deleted custom exercise', async () => {
      const store = useCustomExerciseStore.getState()
      const live = await store.create(input)
      const gone = await store.create({ ...input, name: 'Old Move' })
      await store.remove(gone.id)

      expect(isDeletedExercise({ source: 'custom', exerciseId: gone.id })).toBe(true)
      expect(isDeletedExercise({ source: 'custom', exerciseId: live.id })).toBe(false)
      expect(isDeletedExercise({ source: 'custom', exerciseId: 'unknown' })).toBe(false)
      expect(isDeletedExercise({ source: 'db', exerciseId: getAllExercises()[0].id })).toBe(false)
    })
  })

  it('hasRequiredTargets needs sets, min and max', () => {
    expect(hasRequiredTargets({ workingSets: 3, repMin: 8, repMax: 12 })).toBe(true)
    expect(hasRequiredTargets({ repMin: 8, repMax: 12 })).toBe(false)
    expect(hasRequiredTargets({ workingSets: 3, repMax: 12 })).toBe(false)
    expect(hasRequiredTargets({ workingSets: 3, repMin: 8 })).toBe(false)
  })

  describe('firstIncompleteExercise', () => {
    const ref = { source: 'db', exerciseId: 'x' } as const
    const done = { workingSets: 3, repMin: 8, repMax: 12 }
    const ex = (id: string, full: boolean) => ({ id, exerciseRef: ref, ...(full ? done : {}) })

    it('returns the first gap in day then exercise order, skipping rest days', () => {
      const draft = {
        days: [
          { id: 'd1', name: 'Day 1', exercises: [ex('a', true)] },
          { id: 'd2', name: 'Day 2', exercises: [] },
          { id: 'd3', name: 'Day 3', exercises: [ex('b', true), ex('c', false), ex('d', false)] },
        ],
      }
      expect(firstIncompleteExercise(draft)).toEqual({ dayId: 'd3', exerciseId: 'c' })
    })

    it('returns null when complete or when every day is a rest day', () => {
      expect(
        firstIncompleteExercise({ days: [{ id: 'd1', name: 'D', exercises: [ex('a', true)] }] }),
      ).toBeNull()
      expect(
        firstIncompleteExercise({
          days: [
            { id: 'd1', name: 'D1', exercises: [] },
            { id: 'd2', name: 'D2', exercises: [] },
          ],
        }),
      ).toBeNull()
    })
  })

  it('formatTargets summarises complete targets and is null otherwise', () => {
    expect(formatTargets({ workingSets: 3, repMin: 8, repMax: 12 })).toBe('3 × 8–12 · RIR 0')
    expect(formatTargets({ workingSets: 4, repMin: 8, repMax: 8, rirTarget: 2 })).toBe(
      '4 × 8 · RIR 2',
    )
    expect(formatTargets({ workingSets: 3, repMin: 8, repMax: 12, restSeconds: 150 })).toBe(
      '3 × 8–12 · RIR 0 · rest 2:30',
    )
    expect(formatTargets({ workingSets: 3, repMin: 8 })).toBeNull()
  })

  it('restDigitsToSeconds reads digits as mm ss from the right', () => {
    expect(restDigitsToSeconds('')).toBeUndefined()
    expect(restDigitsToSeconds('abc')).toBeUndefined()
    expect(restDigitsToSeconds('230')).toBe(150)
    expect(restDigitsToSeconds('90')).toBe(90)
    expect(restDigitsToSeconds('1000')).toBe(600)
    expect(restDigitsToSeconds('2:30')).toBe(150)
    expect(restDigitsToSeconds('123456')).toBe(2096)
  })

  it('secondsToRestDigits round-trips', () => {
    expect(secondsToRestDigits(undefined)).toBe('')
    expect(secondsToRestDigits(150)).toBe('230')
    expect(restDigitsToSeconds(secondsToRestDigits(150))).toBe(150)
    expect(secondsToRestDigits(600)).toBe('1000')
    expect(secondsToRestDigits(0)).toBe('0')
  })
})

describe('pass helpers (LG-021)', () => {
  const ids = ['push', 'rest', 'pull']
  const days = ids.map((id) => ({ id }))

  it('passState handles an empty list', () => {
    expect(passState([], ['x'])).toEqual({ states: [], nextIndex: -1, doneCount: 0 })
  })

  it('passState with nothing done puts next on day 0', () => {
    expect(passState(days, undefined)).toEqual({
      states: ['next', 'upcoming', 'upcoming'],
      nextIndex: 0,
      doneCount: 0,
    })
  })

  it('passState supports out-of-order done days', () => {
    const six = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
    expect(passState(six, ['a', 'c', 'd'])).toEqual({
      states: ['done', 'next', 'done', 'done'],
      nextIndex: 1,
      doneCount: 3,
    })
    expect(passState(days, ['pull']).states).toEqual(['next', 'upcoming', 'done'])
  })

  it('passState ignores stale ids', () => {
    const result = passState(days, ['gone', 'push'])
    expect(result.doneCount).toBe(1)
    expect(result.nextIndex).toBe(1)
  })

  it('passState guards a full set by starting over', () => {
    expect(passState(days, ids)).toEqual({
      states: ['next', 'upcoming', 'upcoming'],
      nextIndex: 0,
      doneCount: 3,
    })
  })

  it('passState works for a one-day program', () => {
    expect(passState([{ id: 'a' }], [])).toEqual({ states: ['next'], nextIndex: 0, doneCount: 0 })
  })

  it('normalizePass keeps only known ids in day order, without duplicates', () => {
    expect(normalizePass(ids, ['pull', 'ghost', 'push', 'pull'])).toEqual({
      completedDayIds: ['push', 'pull'],
      currentDayIndex: 1,
      passCompleted: false,
    })
  })

  it('normalizePass resets on a full set', () => {
    expect(normalizePass(ids, ['pull', 'rest', 'push'])).toEqual({
      completedDayIds: [],
      currentDayIndex: 0,
      passCompleted: true,
    })
    expect(normalizePass(['a'], ['a']).passCompleted).toBe(true)
  })

  it('normalizePass returns an empty result for no days', () => {
    expect(normalizePass([], ['a'])).toEqual({
      completedDayIds: [],
      currentDayIndex: 0,
      passCompleted: false,
    })
  })

  it('dayAfter moves forward and wraps', () => {
    expect(dayAfter(ids, [], 0)).toBe(1)
    expect(dayAfter(ids, ['push'], 2)).toBe(1)
  })

  it('dayAfter skips done days', () => {
    expect(dayAfter(ids, ['pull'], 0)).toBe(1)
    expect(dayAfter(['a', 'b', 'c', 'd'], ['b', 'c'], 0)).toBe(3)
    expect(dayAfter(['a', 'b', 'c', 'd'], ['a', 'b'], 3)).toBe(2)
  })

  it('dayAfter returns 0 when completing would finish the pass', () => {
    expect(dayAfter(ids, ['push', 'pull'], 1)).toBe(0)
  })

  it('dayAfter on a one-day program returns the same day', () => {
    expect(dayAfter(['a'], [], 0)).toBe(0)
  })
})
