import { describe, expect, it } from 'vitest'
import { getAllExercises } from '@/exercises/catalog'
import type { ProgramTree } from '@/db/repos/programs'
import {
  NEW_PROGRAM_NAME,
  countWorkouts,
  emptyDraft,
  exerciseName,
  isRestDay,
  nextDayName,
  programTreeToDraft,
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
})
