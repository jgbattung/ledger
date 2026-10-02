import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { newId } from '@/db/ids'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos/programs'
import { programDays } from '@/db/repos/programDays'
import { programExercises } from '@/db/repos/programExercises'
import { workouts } from '@/db/repos/workouts'
import { workoutExercises } from '@/db/repos/workoutExercises'
import { sets } from '@/db/repos/sets'
import { programTreeToDraft } from '@/programs/model'
import { useProgramDraftStore } from '@/stores/programDraftStore'
import type { DraftExercise, ProgramDraft } from '@/programs/model'
import type { Program } from '@/db/types'

const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function exercise(exerciseId: string): DraftExercise {
  return { id: newId(), exerciseRef: ref(exerciseId) }
}

function pplDraft(): ProgramDraft {
  return {
    id: newId(),
    isNew: true,
    name: 'PPL',
    notes: 'Six days',
    isActive: false,
    isArchived: false,
    days: [
      { id: newId(), name: 'Push', notes: 'heavy', exercises: [exercise('a'), exercise('b')] },
      { id: newId(), name: 'Pull', exercises: [exercise('c')] },
      { id: newId(), name: 'Legs', exercises: [exercise('d')] },
      { id: newId(), name: 'Rest', exercises: [] },
    ],
  }
}

async function insertProgram(name: string, patch: Partial<Program> = {}) {
  return programs.create({
    name,
    isActive: false,
    isArchived: false,
    currentDayIndex: 0,
    currentCycleIndex: 0,
    ...patch,
  })
}

describe('programs repo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('setActive enforces at most one active program', async () => {
    const programA = await programs.create({
      name: 'Program A',
      isActive: true,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })
    const programB = await programs.create({
      name: 'Program B',
      isActive: false,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })

    await db.syncState.clear()
    await programs.setActive(programB.id)

    const refreshedA = await programs.get(programA.id)
    const refreshedB = await programs.get(programB.id)
    expect(refreshedA?.isActive).toBe(false)
    expect(refreshedB?.isActive).toBe(true)

    const dirtyA = await db.syncState.get(['programs', programA.id])
    const dirtyB = await db.syncState.get(['programs', programB.id])
    expect(dirtyA).toBeDefined()
    expect(dirtyB).toBeDefined()
  })

  it('saveTree creates a 4-day tree and loadTree round-trips it', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)

    const tree = await programs.loadTree(draft.id)
    expect(tree?.program).toMatchObject({ name: 'PPL', notes: 'Six days', isActive: false })
    expect(tree?.days.map((d) => d.day.name)).toEqual(['Push', 'Pull', 'Legs', 'Rest'])
    expect(tree?.days.map((d) => d.day.orderIndex)).toEqual([0, 1, 2, 3])
    expect(tree?.days[0].day.notes).toBe('heavy')
    expect(tree?.days[3].exercises).toHaveLength(0)
    expect(tree?.days[0].exercises.map((e) => e.exerciseRef.exerciseId)).toEqual(['a', 'b'])
    expect(tree?.days[0].exercises[0].repMin).toBeUndefined()
    expect(tree?.days[0].exercises[0].workingSets).toBeUndefined()
    expect(tree?.days.every((d) => d.day.isRestDay === undefined)).toBe(true)

    const draftBack = programTreeToDraft(tree!)
    expect(draftBack.days.map((d) => d.exercises.length)).toEqual([2, 1, 1, 0])
  })

  it('saveTree reorders, removes and renames; removed rows soft-delete and untouched rows are not rewritten', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)
    const [push, pull, legs, rest] = draft.days
    const legsRowBefore = await db.programDays.get(legs.id)
    const legsExerciseBefore = await db.programExercises.get(legs.exercises[0].id)
    await wait(5)

    const edited: ProgramDraft = {
      ...draft,
      name: 'Renamed',
      days: [legs, { ...push, exercises: [push.exercises[1]] }, rest],
    }
    await programs.saveTree(edited)

    const tree = await programs.loadTree(draft.id)
    expect(tree?.program.name).toBe('Renamed')
    expect(tree?.days.map((d) => d.day.name)).toEqual(['Legs', 'Push', 'Rest'])
    expect(tree?.days.map((d) => d.day.orderIndex)).toEqual([0, 1, 2])
    expect(tree?.days[1].exercises.map((e) => e.exerciseRef.exerciseId)).toEqual(['b'])

    expect((await db.programDays.get(pull.id))?.deletedAt).not.toBeNull()
    expect((await db.programExercises.get(pull.exercises[0].id))?.deletedAt).not.toBeNull()
    expect((await db.programExercises.get(push.exercises[0].id))?.deletedAt).not.toBeNull()

    // Legs moved from position 2 to 0 so it is rewritten; its exercise is untouched.
    expect((await db.programDays.get(legs.id))?.updatedAt).toBeGreaterThan(legsRowBefore!.updatedAt)
    expect((await db.programExercises.get(legs.exercises[0].id))?.updatedAt).toBe(
      legsExerciseBefore!.updatedAt,
    )

    // A repeat save with no changes writes nothing.
    const daysSnapshot = await db.programDays.toArray()
    const exercisesSnapshot = await db.programExercises.toArray()
    const programSnapshot = await db.programs.toArray()
    await wait(5)
    await programs.saveTree(edited)
    expect(await db.programDays.toArray()).toEqual(daysSnapshot)
    expect(await db.programExercises.toArray()).toEqual(exercisesSnapshot)
    expect(await db.programs.toArray()).toEqual(programSnapshot)
  })

  it('removing a day soft-deletes its programExercises and loadTree omits them', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)
    const [push, pull, legs, rest] = draft.days
    await programs.saveTree({ ...draft, days: [push, legs, rest] })

    for (const row of pull.exercises) {
      expect((await db.programExercises.get(row.id))?.deletedAt).not.toBeNull()
    }
    expect((await db.programDays.get(pull.id))?.deletedAt).not.toBeNull()
    const tree = await programs.loadTree(draft.id)
    expect(tree?.days.map((d) => d.day.name)).toEqual(['Push', 'Legs', 'Rest'])
    const loadedIds = tree!.days.flatMap((d) => d.exercises.map((e) => e.id))
    expect(loadedIds).not.toContain(pull.exercises[0].id)
    expect((await db.programExercises.get(push.exercises[0].id))?.deletedAt).toBeNull()
  })

  it('clearing program and day notes through the store is not a change', async () => {
    const draft = pplDraft()
    delete draft.notes
    delete draft.days[0].notes
    await programs.saveTree(draft)
    const programBefore = await db.programs.get(draft.id)
    const dayBefore = await db.programDays.get(draft.days[0].id)
    await wait(5)

    // The store normalises "" to absent, so type-then-clear leaves the draft unchanged.
    const store = useProgramDraftStore
    store.getState().reset()
    expect(await store.getState().load(draft.id)).toBe(true)
    store.getState().setNotes('x')
    store.getState().setDayNotes(draft.days[0].id, 'y')
    store.getState().setNotes('')
    store.getState().setDayNotes(draft.days[0].id, '')
    await programs.saveTree(store.getState().draft!)
    store.getState().reset()

    expect(await db.programs.get(draft.id)).toEqual(programBefore)
    expect(await db.programDays.get(draft.days[0].id)).toEqual(dayBefore)
  })

  it('saveTree on a soft-deleted program rejects with "Program not found" and writes nothing', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)
    await programs.softDeleteCascade(draft.id)
    const programRows = await db.programs.toArray()
    const dayRows = await db.programDays.toArray()
    const exerciseRows = await db.programExercises.toArray()
    const syncRows = await db.syncState.toArray()
    await wait(5)

    const edited: ProgramDraft = { ...draft, name: 'Zombie', days: [{ id: newId(), name: 'New', exercises: [exercise('z')] }] }
    await expect(programs.saveTree(edited)).rejects.toThrow('Program not found')

    expect(await db.programs.toArray()).toEqual(programRows)
    expect(await db.programDays.toArray()).toEqual(dayRows)
    expect(await db.programExercises.toArray()).toEqual(exerciseRows)
    expect(await db.syncState.toArray()).toEqual(syncRows)
  })

  it('marks every written row dirty in syncState', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)
    const expected = [
      ['programs', draft.id],
      ...draft.days.map((d) => ['programDays', d.id]),
      ...draft.days.flatMap((d) => d.exercises.map((e) => ['programExercises', e.id])),
    ]
    for (const [table, id] of expected) {
      expect(await db.syncState.get([table, id]), `${table}:${id}`).toBeDefined()
    }
  })

  it('saveTree with activate leaves exactly one active program', async () => {
    const other = await insertProgram('Other', { isActive: true })
    const draft = pplDraft()
    await programs.saveTree(draft, { activate: true })

    const live = await programs.listLive()
    expect(live.filter((p) => p.isActive).map((p) => p.id)).toEqual([draft.id])
    expect((await programs.get(other.id))?.isActive).toBe(false)
  })

  it('saveTree refuses to activate an archived program', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)
    await programs.archive(draft.id)
    await expect(programs.saveTree(draft, { activate: true })).rejects.toThrow()
  })

  it('setActive on an archived program throws', async () => {
    const archived = await insertProgram('Old', { isArchived: true })
    await expect(programs.setActive(archived.id)).rejects.toThrow()
    expect((await programs.get(archived.id))?.isActive).toBe(false)
  })

  it('archive and softDeleteCascade clear isActive; deactivate and unarchive flip flags', async () => {
    const a = await insertProgram('A', { isActive: true })
    await programs.deactivate(a.id)
    expect((await programs.get(a.id))?.isActive).toBe(false)

    await programs.setActive(a.id)
    await programs.archive(a.id)
    expect(await programs.get(a.id)).toMatchObject({ isActive: false, isArchived: true })
    await programs.unarchive(a.id)
    expect((await programs.get(a.id))?.isArchived).toBe(false)

    const b = pplDraft()
    await programs.saveTree(b, { activate: true })
    await programs.softDeleteCascade(b.id)
    expect((await db.programs.get(b.id))?.isActive).toBe(false)
  })

  it('softDeleteCascade hides the program, days and exercises from every list method', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)
    await programs.softDeleteCascade(draft.id)

    expect(await programs.get(draft.id)).toBeUndefined()
    expect((await programs.listLive()).map((p) => p.id)).not.toContain(draft.id)
    expect(await programs.loadTree(draft.id)).toBeUndefined()
    expect(await programs.listTrees()).toEqual([])
    expect(await programDays.listByProgram(draft.id)).toEqual([])
    for (const day of draft.days) {
      expect(await programExercises.listByDay(day.id)).toEqual([])
    }
    expect(await db.syncState.get(['programs', draft.id])).toBeDefined()
  })

  it('HISTORY GUARD: archive and softDeleteCascade never touch workouts, workoutExercises or sets', async () => {
    const draft = pplDraft()
    await programs.saveTree(draft)
    const workout = await workouts.create({
      programId: draft.id,
      programDayId: draft.days[0].id,
      name: 'Push',
      startedAt: 1,
      finishedAt: 2,
      status: 'finished',
    })
    const workoutExercise = await workoutExercises.create({
      workoutId: workout.id,
      orderIndex: 0,
      exerciseRef: ref('a'),
    })
    const set = await sets.create({
      workoutExerciseId: workoutExercise.id,
      orderIndex: 0,
      type: 'working',
      weight: 100,
      reps: 5,
      rir: 1,
      rirIsPlus: false,
    })
    await wait(5)

    await programs.archive(draft.id)
    await programs.softDeleteCascade(draft.id)

    expect(await workouts.get(workout.id)).toEqual(workout)
    expect(await workoutExercises.get(workoutExercise.id)).toEqual(workoutExercise)
    expect(await sets.get(set.id)).toEqual(set)
  })
})
