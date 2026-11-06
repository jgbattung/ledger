import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { workouts } from '@/db/repos/workouts'
import { useSessionStore } from '@/stores/sessionStore'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { seedProgram } from '@/workouts/test-fixtures'

const store = () => useSessionStore.getState()
const settle = async () => {
  await store().flushNotes()
}

async function startPush() {
  const seeded = await seedProgram()
  await store().start(seeded.programId, seeded.pushId)
  return seeded
}

describe('sessionStore', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useRestTimerStore.setState({ onSetCompleted: () => {} })
  })

  it('starts empty and hydrates to no workout', async () => {
    expect(store().workout).toBeNull()
    await store().hydrate()
    expect(store().hydrated).toBe(true)
    expect(store().workout).toBeNull()
  })

  it('start loads the session and focuses the first exercise', async () => {
    await startPush()
    expect(store().workout?.name).toBe('Push')
    expect(store().exercises).toHaveLength(2)
    expect(store().focusedExerciseId).toBe(store().exercises[0].exercise.id)
  })

  it('hydrate twice for the same workout loads once', async () => {
    await startPush()
    const spy = vi.spyOn(workouts, 'loadSession')
    await Promise.all([store().hydrate(), store().hydrate()])
    await store().hydrate()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()

    store().reset()
    const loadSpy = vi.spyOn(workouts, 'loadSession')
    await Promise.all([store().hydrate(), store().hydrate()])
    await store().hydrate()
    expect(loadSpy).toHaveBeenCalledTimes(1)
    loadSpy.mockRestore()
  })

  it('key presses update state synchronously and Dexie ends up with the last state', async () => {
    await startPush()
    const first = store().exercises[0].sets[0]
    store().openPad(first.id, 'weight')
    for (const key of ['6', '2', '.', '5'] as const) store().padKey(key)
    expect(store().exercises[0].sets[0].weight).toBe(62.5)

    store().padNext()
    expect(store().pad?.entry.field).toBe('reps')
    store().padKey('8')
    store().padKey('fp')
    store().padKey('2')
    expect(store().exercises[0].sets[0]).toMatchObject({ reps: 8, partialReps: 2 })

    await settle()
    const stored = await db.sets.get(first.id)
    expect(stored).toMatchObject({ weight: 62.5, reps: 8, partialReps: 2 })
  })

  it('Next walks weight, reps, next set, then the next exercise', async () => {
    await startPush()
    const [bench, fly] = store().exercises
    const last = bench.sets[bench.sets.length - 1]
    store().openPad(last.id, 'reps')
    store().padNext()
    expect(store().pad).toMatchObject({ setId: fly.sets[0].id })
    expect(store().pad?.entry.field).toBe('weight')
    expect(store().focusedExerciseId).toBe(fly.exercise.id)
  })

  it('Next after the very last field closes the pad', async () => {
    await startPush()
    const fly = store().exercises[1]
    store().openPad(fly.sets[fly.sets.length - 1].id, 'reps')
    store().padNext()
    expect(store().pad).toBeNull()
  })

  it('checking a set with 0 reps opens the pad on reps instead of stamping', async () => {
    await startPush()
    const onSetCompleted = vi.fn()
    useRestTimerStore.setState({ onSetCompleted })
    const first = store().exercises[0].sets[0]
    store().toggleComplete(first.id)
    expect(store().exercises[0].sets[0].completedAt).toBeUndefined()
    expect(store().pad).toMatchObject({ setId: first.id })
    expect(store().pad?.entry.field).toBe('reps')
    expect(onSetCompleted).not.toHaveBeenCalled()
  })

  it('calls onSetCompleted once per stamp and not on uncheck', async () => {
    await startPush()
    const onSetCompleted = vi.fn()
    useRestTimerStore.setState({ onSetCompleted })
    const entry = store().exercises[0]
    const first = entry.sets[0]
    store().openPad(first.id, 'reps')
    store().padKey('8')
    store().closePad()

    store().toggleComplete(first.id)
    expect(onSetCompleted).toHaveBeenCalledTimes(1)
    expect(onSetCompleted).toHaveBeenCalledWith(entry.exercise.id)
    store().toggleComplete(first.id)
    expect(onSetCompleted).toHaveBeenCalledTimes(1)
    await settle()
    expect((await db.sets.get(first.id))?.completedAt).toBeUndefined()
  })

  it('clearing the reps of a checked set unchecks it', async () => {
    await startPush()
    const first = store().exercises[0].sets[0]
    store().openPad(first.id, 'reps')
    store().padKey('8')
    store().toggleComplete(first.id)
    expect(store().exercises[0].sets[0].completedAt).toBeTypeOf('number')
    store().openPad(first.id, 'reps')
    store().padKey('back')
    expect(store().exercises[0].sets[0].completedAt).toBeUndefined()
    await settle()
    expect((await db.sets.get(first.id))?.completedAt).toBeUndefined()
  })

  it('setRir round-trips 6+', async () => {
    await startPush()
    const first = store().exercises[0].sets[0]
    store().setRir(first.id, 6, true)
    await settle()
    expect(await db.sets.get(first.id)).toMatchObject({ rir: 6, rirIsPlus: true })
  })

  it('addSet appends with a safe orderIndex and removeSet renumbers via memory', async () => {
    await startPush()
    const bench = store().exercises[0]
    store().removeSet(bench.sets[1].id)
    await store().addSet(bench.exercise.id)
    expect(store().exercises[0].sets.map((s) => s.orderIndex)).toEqual([0, 2, 3])
    await settle()
    expect((await db.sets.get(bench.sets[1].id))?.deletedAt).toBeTypeOf('number')
  })

  it('debounces notes by 400ms and flushes on finish', async () => {
    await startPush()
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const bench = store().exercises[0]
    store().setExerciseNote(bench.exercise.id, 'a')
    store().setExerciseNote(bench.exercise.id, 'ab')
    store().setWorkoutNote('felt good')
    await wait(150)
    expect((await db.workoutExercises.get(bench.exercise.id))?.notes).toBeUndefined()
    await wait(450)
    await settle()
    expect((await db.workoutExercises.get(bench.exercise.id))?.notes).toBe('ab')
    expect((await db.workouts.get(store().workout!.id))?.notes).toBe('felt good')

    store().setExerciseNote(bench.exercise.id, 'final')
    const id = store().workout!.id
    await store().finish()
    expect((await db.workoutExercises.get(bench.exercise.id))?.notes).toBe('final')
    expect((await db.workouts.get(id))?.status).toBe('finished')
    expect(store().workout).toBeNull()
  })

  it('survives a reload: a fresh store hydrates the persisted state', async () => {
    await startPush()
    const first = store().exercises[0].sets[0]
    store().openPad(first.id, 'weight')
    store().padKey('7')
    store().padKey('5')
    await settle()

    store().reset()
    expect(store().workout).toBeNull()
    await store().hydrate()
    expect(store().exercises[0].sets[0].weight).toBe(75)
  })

  it('discard clears the session and marks the workout discarded', async () => {
    await startPush()
    const id = store().workout!.id
    await store().discard()
    expect((await db.workouts.get(id))?.status).toBe('discarded')
    expect(store().workout).toBeNull()
  })

  it('swap refreshes the exercise and keeps focus', async () => {
    await startPush()
    const bench = store().exercises[0]
    await store().swap(bench.exercise.id, { source: 'db', exerciseId: 'db-press' }, 'keep')
    expect(store().exercises[0].exercise.exerciseRef.exerciseId).toBe('db-press')
    expect(store().exercises[0].exercise.swappedFrom?.exerciseId).toBe('bench')
  })

  it('loads previous sets from the newest finished workout', async () => {
    const seeded = await seedProgram()
    await store().start(seeded.programId, seeded.pushId)
    const first = store().exercises[0].sets[0]
    store().openPad(first.id, 'weight')
    store().padKey('6')
    store().padKey('0')
    store().padNext()
    store().padKey('8')
    store().closePad()
    store().toggleComplete(first.id)
    await store().finish()

    await store().start(seeded.programId, seeded.pullId)
    await store().finish()
    await store().start(seeded.programId, seeded.pushId)
    const previous = store().previousByExercise[store().exercises[0].exercise.id]
    expect(previous[0]).toMatchObject({ weight: 60, reps: 8 })
  })
})
