import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { workouts } from '@/db/repos/workouts'
import { useSessionStore } from '@/stores/sessionStore'
import { __resetRestTimerForTests, useRestTimerStore } from '@/stores/restTimerStore'
import { exercise, seedProgram } from '@/workouts/test-fixtures'
import { exerciseName } from '@/programs/model'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'

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
    __resetRestTimerForTests()
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

  it('a deleted custom exercise in the program day is still started, named and loggable (LIB-7, decision C)', async () => {
    const row = await useCustomExerciseStore.getState().create({
      name: 'SSB Squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      mechanic: 'compound',
    })
    const customRef = { source: 'custom' as const, exerciseId: row.id }
    await useCustomExerciseStore.getState().remove(row.id)
    const seeded = await seedProgram([{ ...exercise('bench'), exerciseRef: customRef }])
    await store().start(seeded.programId, seeded.pushId)

    const entry = store().exercises[0]
    expect(entry.exercise.exerciseRef).toEqual(customRef)
    expect(exerciseName(entry.exercise.exerciseRef)).toBe('SSB Squat')
    const set = entry.sets[0]
    store().openPad(set.id, 'reps')
    store().padKey('8')
    store().toggleComplete(set.id)
    await store().finish()
    expect((await db.sets.get(set.id))?.completedAt).not.toBeNull()
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

  describe('auto-advance on the last set', () => {
    function logAndCheck(setId: string) {
      store().openPad(setId, 'reps')
      store().padKey('8')
      store().toggleComplete(setId)
    }

    it('does not advance when a non-final set is checked, or when a set is unchecked', async () => {
      await startPush()
      const [bench] = store().exercises
      logAndCheck(bench.sets[0].id)
      expect(store().focusedExerciseId).toBe(bench.exercise.id)
      store().toggleComplete(bench.sets[0].id)
      expect(store().focusedExerciseId).toBe(bench.exercise.id)
    })

    it('moves focus to the next exercise and closes the pad on the last set', async () => {
      await startPush()
      const [bench, fly] = store().exercises
      bench.sets.slice(0, -1).forEach((row) => logAndCheck(row.id))
      store().openPad(bench.sets[bench.sets.length - 1].id, 'reps')
      store().padKey('8')
      expect(store().pad).not.toBeNull()
      store().toggleComplete(bench.sets[bench.sets.length - 1].id)
      expect(store().focusedExerciseId).toBe(fly.exercise.id)
      expect(store().pad).toBeNull()
    })

    it('wraps to the first incomplete exercise and stays put when all are done', async () => {
      await startPush()
      const [bench, fly] = store().exercises
      store().focusExercise(fly.exercise.id)
      fly.sets.forEach((row) => logAndCheck(row.id))
      expect(store().focusedExerciseId).toBe(bench.exercise.id)
      bench.sets.forEach((row) => logAndCheck(row.id))
      expect(store().focusedExerciseId).toBe(bench.exercise.id)
    })
  })

  describe('pause and resume', () => {
    const persisted = async () => {
      await store().flushNotes()
      return db.workouts.get(store().workout!.id)
    }

    it('pause persists pausedAt and survives a re-hydrate', async () => {
      await startPush()
      store().pause()
      const at = store().workout!.pausedAt!
      expect(at).toBeGreaterThan(0)
      expect((await persisted())?.pausedAt).toBe(at)
      store().reset()
      await store().hydrate()
      expect(store().workout?.pausedAt).toBe(at)
    })

    it('pausing twice keeps the first timestamp', async () => {
      await startPush()
      store().pause()
      const at = store().workout!.pausedAt
      store().pause()
      expect(store().workout?.pausedAt).toBe(at)
    })

    it('resume banks the closed pause and persists it', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(100_000)
      await startPush()
      store().pause()
      vi.setSystemTime(107_000)
      store().resume()
      expect(store().workout).toMatchObject({ pausedAt: null, pausedMs: 7_000 })
      expect(await persisted()).toMatchObject({ pausedAt: null, pausedMs: 7_000 })
    })

    it('checking a set while paused resumes the clock', async () => {
      await startPush()
      const [bench] = store().exercises
      store().pause()
      store().openPad(bench.sets[0].id, 'reps')
      store().padKey('8')
      store().toggleComplete(bench.sets[0].id)
      expect(store().workout?.pausedAt).toBeNull()
      expect((await persisted())?.pausedAt).toBeNull()
    })

    it('unchecking while paused does not resume', async () => {
      await startPush()
      const [bench] = store().exercises
      store().openPad(bench.sets[0].id, 'reps')
      store().padKey('8')
      store().toggleComplete(bench.sets[0].id)
      store().pause()
      store().toggleComplete(bench.sets[0].id)
      expect(store().workout?.pausedAt).not.toBeNull()
    })

    it('opening the pad on an empty set while paused does not resume', async () => {
      await startPush()
      const [bench] = store().exercises
      store().pause()
      store().toggleComplete(bench.sets[0].id)
      expect(store().workout?.pausedAt).not.toBeNull()
    })

    it('finish while paused records the folded pausedMs', async () => {
      await startPush()
      const id = store().workout!.id
      const startedAt = store().workout!.startedAt
      store().pause()
      await store().flushNotes()
      await db.workouts.update(id, { pausedAt: startedAt - 30_000 })
      store().reset()
      await store().hydrate()
      await store().finish()
      const row = await db.workouts.get(id)
      expect(row?.pausedAt).toBeNull()
      expect(row?.pausedMs).toBeGreaterThanOrEqual(30_000)
    })
  })

  describe('flush on pagehide and visibilitychange', () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    async function editThenLeave(leave: () => void) {
      await startPush()
      const bench = store().exercises[0]
      const first = bench.sets[0].id
      store().openPad(first, 'reps')
      store().padKey('9')
      store().setExerciseNote(bench.exercise.id, 'last words')
      store().setWorkoutNote('session')
      leave()
      // Far less than the 400ms note debounce, and no flushNotes() call.
      await wait(80)
      expect((await db.sets.get(first))?.reps).toBe(9)
      expect((await db.workoutExercises.get(bench.exercise.id))?.notes).toBe('last words')
      expect((await db.workouts.get(store().workout!.id))?.notes).toBe('session')
    }

    it('persists the last edit and pending notes on pagehide', async () => {
      await editThenLeave(() => window.dispatchEvent(new Event('pagehide')))
    })

    it('persists them when the tab becomes hidden', async () => {
      const original = Object.getOwnPropertyDescriptor(document, 'visibilityState')
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      try {
        await editThenLeave(() => document.dispatchEvent(new Event('visibilitychange')))
      } finally {
        if (original) Object.defineProperty(document, 'visibilityState', original)
        else delete (document as unknown as Record<string, unknown>).visibilityState
      }
    })

    it('does nothing harmful when there is nothing pending', async () => {
      await startPush()
      expect(() => store().flushPending()).not.toThrow()
    })
  })

  describe('note journal (reload safety)', () => {
    const KEY = 'ledger.pendingNotes'

    it('mirrors a pending note to localStorage and drops it once saved', async () => {
      await startPush()
      const bench = store().exercises[0].exercise.id
      store().setExerciseNote(bench, 'draft')
      expect(JSON.parse(localStorage.getItem(KEY)!).notes[bench]).toBe('draft')
      await store().flushNotes()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(localStorage.getItem(KEY)).toBeNull()
    })

    it('replays a journalled note on the next hydrate when the write never landed', async () => {
      await startPush()
      const workoutId = store().workout!.id
      const bench = store().exercises[0].exercise.id
      localStorage.setItem(KEY, JSON.stringify({ workoutId, notes: { [bench]: 'rescued', workout: 'also' } }))
      store().reset()
      localStorage.setItem(KEY, JSON.stringify({ workoutId, notes: { [bench]: 'rescued', workout: 'also' } }))
      await store().hydrate()
      expect(store().exercises[0].exercise.notes).toBe('rescued')
      expect(store().workout?.notes).toBe('also')
      expect((await db.workoutExercises.get(bench))?.notes).toBe('rescued')
      expect(localStorage.getItem(KEY)).toBeNull()
    })

    it('ignores a journal that belongs to another workout', async () => {
      await startPush()
      const bench = store().exercises[0].exercise.id
      store().reset()
      localStorage.setItem(KEY, JSON.stringify({ workoutId: 'someone-else', notes: { [bench]: 'x' } }))
      await store().hydrate()
      expect(store().exercises[0].exercise.notes).toBeUndefined()
      expect(localStorage.getItem(KEY)).toBeNull()
    })
  })
  describe('rest timer lifecycle', () => {
    const REST_KEY = 'ledger-rest-timer'
    const rest = () => useRestTimerStore.getState()

    async function startRest() {
      await startPush()
      rest().start(120)
      expect(rest().endsAt).not.toBeNull()
    }

    it('finish clears the running rest timer', async () => {
      await startRest()
      await store().finish()
      expect(rest().endsAt).toBeNull()
      expect(localStorage.getItem(REST_KEY)).toBeNull()
    })

    it('discard clears the running rest timer', async () => {
      await startRest()
      await store().discard()
      expect(rest().endsAt).toBeNull()
      expect(localStorage.getItem(REST_KEY)).toBeNull()
    })

    it('reset clears the running rest timer', async () => {
      await startRest()
      store().reset()
      expect(rest().endsAt).toBeNull()
      expect(localStorage.getItem(REST_KEY)).toBeNull()
    })

    it('pausing and resuming the workout clock leaves the rest running', async () => {
      await startRest()
      const endsAt = rest().endsAt
      store().pause()
      expect(store().workout?.pausedAt).toBeDefined()
      expect(rest().endsAt).toBe(endsAt)
      store().resume()
      expect(rest().endsAt).toBe(endsAt)
      expect(localStorage.getItem(REST_KEY)).not.toBeNull()
    })

    it('hydrating with no in-progress workout clears a stored timer', async () => {
      localStorage.setItem(
        REST_KEY,
        JSON.stringify({ workoutId: 'gone', endsAt: Date.now() + 60_000, totalSeconds: 60 }),
      )
      __resetRestTimerForTests()
      expect(rest().endsAt).not.toBeNull()
      await store().hydrate()
      expect(rest().endsAt).toBeNull()
      expect(localStorage.getItem(REST_KEY)).toBeNull()
    })

    it('hydrating the same workout keeps the timer', async () => {
      await startRest()
      const keep = rest().endsAt
      __resetRestTimerForTests() // reload: storage read at module load
      useSessionStore.setState({ hydrated: false, hydratedWorkoutId: null })
      await store().hydrate()
      expect(rest().endsAt).toBe(keep)
      expect(localStorage.getItem(REST_KEY)).not.toBeNull()
    })
  })
})

describe('sessionStore - L/R sets (LG-012)', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetRestTimerForTests()
  })

  const type = (...keys: Parameters<ReturnType<typeof store>['padKey']>[0][]) => {
    for (const key of keys) store().padKey(key)
  }

  it('typing L then R persists both sides and the aggregate', async () => {
    await startPush()
    const bench = store().exercises[0]
    store().setUnilateral(bench.exercise.id, true)
    const id = bench.sets[0].id

    store().openPad(id, 'weight', 'L')
    type('2', '0')
    store().padNext()
    expect(store().pad?.entry).toMatchObject({ field: 'reps', side: 'L' })
    type('1', '2')
    store().padNext()
    expect(store().pad?.entry).toMatchObject({ field: 'weight', side: 'R' })
    type('2', '2')
    store().padNext()
    expect(store().pad?.entry).toMatchObject({ field: 'reps', side: 'R' })
    type('1', '0')

    expect(store().exercises[0].sets[0]).toMatchObject({ weight: 22, reps: 10 })
    await settle()
    const stored = await db.sets.get(id)
    expect(stored?.unilateral).toEqual({
      leftWeight: 20,
      leftReps: 12,
      rightWeight: 22,
      rightReps: 10,
    })
    expect(stored).toMatchObject({ weight: 22, reps: 10 })
    expect(stored?.partialReps).toBeUndefined()
  })

  it('stores a per-side partial and never a set-level one', async () => {
    await startPush()
    const bench = store().exercises[0]
    store().setUnilateral(bench.exercise.id, true)
    const id = bench.sets[0].id
    store().openPad(id, 'reps', 'R')
    type('8', 'fp', '2')
    await settle()
    const stored = await db.sets.get(id)
    expect(stored?.unilateral).toMatchObject({ rightReps: 8, rightPartialReps: 2 })
    expect(stored?.partialReps).toBeUndefined()
  })

  it('checking an L/R set with one side empty opens the pad on that side', async () => {
    await startPush()
    const bench = store().exercises[0]
    store().setUnilateral(bench.exercise.id, true)
    const id = bench.sets[0].id
    store().toggleComplete(id)
    expect(store().exercises[0].sets[0].completedAt).toBeUndefined()
    expect(store().pad?.entry).toMatchObject({ field: 'reps', side: 'L' })

    store().openPad(id, 'reps', 'L')
    type('1', '0')
    store().toggleComplete(id)
    expect(store().pad?.entry).toMatchObject({ field: 'reps', side: 'R' })
    type('9')
    store().toggleComplete(id)
    expect(store().exercises[0].sets[0].completedAt).toBeTypeOf('number')
  })

  it('clearing a side reps unchecks the set', async () => {
    await startPush()
    const bench = store().exercises[0]
    store().setUnilateral(bench.exercise.id, true)
    const id = bench.sets[0].id
    store().openPad(id, 'reps', 'L')
    type('1', '0')
    store().openPad(id, 'reps', 'R')
    type('9')
    store().toggleComplete(id)
    expect(store().exercises[0].sets[0].completedAt).toBeTypeOf('number')
    type('back')
    expect(store().exercises[0].sets[0].completedAt).toBeUndefined()
    await settle()
    expect((await db.sets.get(id))?.completedAt).toBeUndefined()
  })

  it('toggle on and off persists and closes the pad on that exercise', async () => {
    await startPush()
    const bench = store().exercises[0]
    const id = bench.sets[0].id
    store().openPad(id, 'weight')
    type('2', '0')
    store().setUnilateral(bench.exercise.id, true)
    expect(store().pad).toBeNull()
    expect(store().exercises[0].sets.every((row) => row.unilateral != null)).toBe(true)
    await settle()
    expect((await db.sets.get(id))?.unilateral).toMatchObject({ leftWeight: 20, rightWeight: 20 })

    store().setUnilateral(bench.exercise.id, false)
    expect(store().exercises[0].sets.every((row) => row.unilateral == null)).toBe(true)
    await settle()
    const stored = await db.sets.get(id)
    expect(stored?.unilateral).toBeUndefined()
    expect(stored?.weight).toBe(20)
  })

  it('hydrate restores L/R sets', async () => {
    await startPush()
    const bench = store().exercises[0]
    store().setUnilateral(bench.exercise.id, true)
    store().openPad(bench.sets[0].id, 'weight', 'R')
    type('3', '0')
    await settle()

    store().reset()
    await store().hydrate()
    expect(store().exercises[0].sets[0].unilateral).toMatchObject({ leftWeight: 0, rightWeight: 30 })
    expect(store().exercises[0].sets[0].weight).toBe(30)
  })

  it('typing right after turning L/R off persists the new values, not a stale merge', async () => {
    await startPush()
    const bench = store().exercises[0]
    const id = bench.sets[0].id
    store().setUnilateral(bench.exercise.id, true)
    await settle()

    // An L/R patch is still queued when L/R goes off and the merged row is edited.
    store().openPad(id, 'reps', 'L')
    type('9')
    store().setUnilateral(bench.exercise.id, false)
    store().openPad(id, 'reps')
    type('1', '1')

    expect(store().exercises[0].sets[0]).toMatchObject({ reps: 11 })
    expect(store().exercises[0].sets[0].unilateral).toBeUndefined()
    await settle()
    const stored = await db.sets.get(id)
    expect(stored?.unilateral).toBeUndefined()
    expect(stored?.reps).toBe(11)
  })

  it('a queued pre-toggle value survives turning L/R on and then off', async () => {
    await startPush()
    const bench = store().exercises[0]
    const id = bench.sets[0].id
    store().openPad(id, 'weight')
    type('2', '5')
    store().setUnilateral(bench.exercise.id, true)
    await settle()
    expect(await db.sets.get(id)).toMatchObject({
      unilateral: { leftWeight: 25, rightWeight: 25 },
      weight: 25,
    })

    store().openPad(id, 'weight', 'R')
    type('back', 'back', '3', '0')
    store().setUnilateral(bench.exercise.id, false)
    await settle()
    const stored = await db.sets.get(id)
    expect(stored?.unilateral).toBeUndefined()
    expect(stored?.weight).toBe(store().exercises[0].sets[0].weight)
  })

  it('typing right after turning L/R on persists the new side values', async () => {
    await startPush()
    const bench = store().exercises[0]
    const id = bench.sets[0].id
    store().openPad(id, 'weight')
    type('2', '0')
    store().setUnilateral(bench.exercise.id, true)
    store().openPad(id, 'weight', 'R')
    type('back', 'back', '2', '2')

    await settle()
    const stored = await db.sets.get(id)
    expect(stored?.unilateral).toMatchObject({ leftWeight: 20, rightWeight: 22 })
    expect(stored?.weight).toBe(22)
  })

  it('toggling L/R keeps a pad that is open on another exercise', async () => {
    await startPush()
    const [bench, fly] = store().exercises
    store().openPad(fly.sets[0].id, 'weight')
    store().setUnilateral(bench.exercise.id, true)
    expect(store().pad?.setId).toBe(fly.sets[0].id)
    expect(store().exercises[1].sets.every((row) => row.unilateral == null)).toBe(true)
  })

  it('Next from the last L/R set right reps moves to the next exercise first set', async () => {
    await startPush()
    const [bench, fly] = store().exercises
    store().setUnilateral(bench.exercise.id, true)
    const last = bench.sets.at(-1)!
    store().openPad(last.id, 'reps', 'R')
    store().padNext()
    expect(store().pad?.setId).toBe(fly.sets[0].id)
    expect(store().pad?.entry).toMatchObject({ field: 'weight' })
    expect(store().pad?.entry.side).toBeUndefined()
  })

  describe('toggle races (B1 re-verification)', () => {
    const fields = (row: { weight: number; reps: number; unilateral?: unknown } | undefined) => ({
      weight: row?.weight,
      reps: row?.reps,
      unilateral: row?.unilateral,
    })
    const memory = (exerciseIndex: number, setIndex: number) =>
      fields(store().exercises[exerciseIndex].sets[setIndex])
    const stored = async (id: string) => fields(await db.sets.get(id))

    it('on, off, on with a queued patch at every step ends with Dexie matching memory', async () => {
      await startPush()
      const bench = store().exercises[0]
      const id = bench.sets[0].id
      store().openPad(id, 'weight')
      type('2', '0')
      store().setUnilateral(bench.exercise.id, true)
      store().openPad(id, 'reps', 'L')
      type('9')
      store().setUnilateral(bench.exercise.id, false)
      store().openPad(id, 'reps')
      type('1', '1')
      store().setUnilateral(bench.exercise.id, true)
      store().openPad(id, 'weight', 'R')
      type('back', 'back', '2', '4')

      expect(memory(0, 0)).toMatchObject({ weight: 24, reps: 11 })
      await settle()
      expect(await stored(id)).toEqual(memory(0, 0))
    })

    it('typing on another exercise across a toggle keeps that exercise values', async () => {
      await startPush()
      const [bench, fly] = store().exercises
      const flyId = fly.sets[0].id
      store().openPad(flyId, 'weight')
      type('1', '5')
      store().setUnilateral(bench.exercise.id, true)
      await settle()
      expect((await db.sets.get(flyId))?.weight).toBe(15)

      store().openPad(flyId, 'reps')
      type('1', '2')
      store().setUnilateral(bench.exercise.id, false)
      type('back', '4')
      await settle()
      expect(await stored(flyId)).toEqual(memory(1, 0))
      expect(memory(1, 0)).toMatchObject({ weight: 15, reps: 14 })
    })

    it('no toggle: coalesced patches across sets all persist', async () => {
      await startPush()
      const [bench, fly] = store().exercises
      store().openPad(bench.sets[0].id, 'weight')
      type('6', '0')
      store().openPad(fly.sets[0].id, 'weight')
      type('1', '2')
      store().openPad(bench.sets[0].id, 'reps')
      type('8')
      store().openPad(bench.sets[1].id, 'reps')
      type('7')
      await settle()
      expect(await stored(bench.sets[0].id)).toEqual(memory(0, 0))
      expect(await stored(bench.sets[1].id)).toEqual(memory(0, 1))
      expect(await stored(fly.sets[0].id)).toEqual(memory(1, 0))
      expect(memory(0, 0)).toMatchObject({ weight: 60, reps: 8 })
    })

    it('a flush (tab hidden) right after turning L/R off keeps the typed value', async () => {
      await startPush()
      const bench = store().exercises[0]
      const id = bench.sets[0].id
      store().setUnilateral(bench.exercise.id, true)
      await settle()

      store().openPad(id, 'reps', 'L')
      type('9')
      store().setUnilateral(bench.exercise.id, false)
      store().openPad(id, 'reps')
      type('1', '1')
      store().flushPending()

      await settle()
      expect(memory(0, 0)).toMatchObject({ reps: 11, unilateral: undefined })
      expect(await stored(id)).toEqual(memory(0, 0))
    })

    it('a flush (tab hidden) right after turning L/R on keeps the aggregate consistent', async () => {
      await startPush()
      const bench = store().exercises[0]
      const id = bench.sets[0].id
      store().openPad(id, 'weight')
      type('2', '0')
      store().setUnilateral(bench.exercise.id, true)
      store().openPad(id, 'weight', 'R')
      type('back', 'back', '2', '2')
      store().flushPending()

      await settle()
      expect(memory(0, 0)).toMatchObject({ weight: 22 })
      expect(await stored(id)).toEqual(memory(0, 0))
    })

    it('a flush with no toggle still writes every pending entry', async () => {
      await startPush()
      const [bench, fly] = store().exercises
      store().openPad(bench.sets[0].id, 'weight')
      type('6', '0')
      store().openPad(fly.sets[0].id, 'reps')
      type('1', '2')
      store().flushPending()

      await settle()
      expect(await stored(bench.sets[0].id)).toEqual(memory(0, 0))
      expect(await stored(fly.sets[0].id)).toEqual(memory(1, 0))
      expect(memory(0, 0)).toMatchObject({ weight: 60 })
      expect(memory(1, 0)).toMatchObject({ reps: 12 })
    })

    it('a reload after a flush shows the memory state, cleared L/R fields included', async () => {
      await startPush()
      const bench = store().exercises[0]
      const id = bench.sets[0].id
      store().setUnilateral(bench.exercise.id, true)
      store().openPad(id, 'reps', 'L')
      type('9')
      store().setUnilateral(bench.exercise.id, false)
      store().openPad(id, 'reps')
      type('1', '1')
      store().flushPending()
      await settle()
      const before = memory(0, 0)

      store().reset()
      await store().hydrate()
      expect(memory(0, 0)).toEqual(before)
      expect(before).toMatchObject({ reps: 11, unilateral: undefined })
      expect('unilateral' in (await db.sets.get(id))!).toBe(false)
    })
  })
})
