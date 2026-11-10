import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import * as chime from '@/lib/restChime'
import {
  __resetRestTimerForTests,
  restRemainingSeconds,
  useRestRemaining,
  useRestTimerStore,
} from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { SessionExercise } from '@/stores/sessionStore'

const T0 = new Date('2026-11-10T10:00:00Z').getTime()
const KEY = 'ledger-rest-timer'
const timer = () => useRestTimerStore.getState()

/** Minimal session: one workout, one exercise with the given rest target. */
function seedSession(restSeconds?: number) {
  useSessionStore.setState({
    workout: { id: 'w1' } as never,
    exercises: [
      {
        exercise: { id: 'we1', targetsSnapshot: restSeconds ? { restSeconds } : undefined },
        sets: [],
      },
    ] as unknown as SessionExercise[],
  })
}

const remaining = () => restRemainingSeconds(timer().endsAt, Date.now())

describe('restTimerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    __resetRestTimerForTests()
    seedSession()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    __resetRestTimerForTests()
    useSessionStore.setState({ workout: null, exercises: [] })
  })

  it('restRemainingSeconds rounds up and floors at 0', () => {
    expect(restRemainingSeconds(null, T0)).toBe(0)
    expect(restRemainingSeconds(T0 + 1500, T0)).toBe(2)
    expect(restRemainingSeconds(T0 - 5000, T0)).toBe(0)
  })

  it('starts at the exercise snapshot rest', () => {
    seedSession(120)
    timer().onSetCompleted('we1')
    expect(remaining()).toBe(120)
    expect(timer().totalSeconds).toBe(120)
  })

  it('falls back to the Settings default', () => {
    timer().setDefaultSeconds(150)
    timer().onSetCompleted('we1')
    expect(remaining()).toBe(150)
  })

  it('defaults to 180 seconds before settings arrive', () => {
    timer().onSetCompleted('we1')
    expect(remaining()).toBe(180)
  })

  it('restarts when another set is checked', () => {
    seedSession(120)
    timer().onSetCompleted('we1')
    vi.advanceTimersByTime(50_000)
    expect(remaining()).toBe(70)
    timer().onSetCompleted('we1')
    expect(remaining()).toBe(120)
  })

  it('does nothing without an in-progress workout', () => {
    useSessionStore.setState({ workout: null })
    timer().start(60)
    expect(timer().endsAt).toBeNull()
  })

  it('falls back to the default for an exercise not in the session', () => {
    seedSession(120)
    timer().setDefaultSeconds(90)
    timer().onSetCompleted('missing')
    expect(remaining()).toBe(90)
  })

  it('ignores a zero or negative rest', () => {
    timer().start(0)
    timer().setRemaining(-15)
    expect(timer().endsAt).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('unlocks audio inside start and setRemaining (the tap)', () => {
    const unlock = vi.spyOn(chime, 'unlockAudio')
    timer().start(60)
    timer().setRemaining(30)
    expect(unlock).toHaveBeenCalledTimes(2)
  })

  it('stores the workout id, absolute end time and total', () => {
    timer().start(90)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      workoutId: 'w1',
      endsAt: T0 + 90_000,
      totalSeconds: 90,
    })
  })

  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(() => timer().start(60)).not.toThrow()
    expect(remaining()).toBe(60)
    expect(() => timer().skip()).not.toThrow()
    expect(timer().endsAt).toBeNull()
  })

  it('setRemaining works from resting and from idle', () => {
    timer().setRemaining(45)
    expect(remaining()).toBe(45)
    expect(timer().totalSeconds).toBe(45)
    timer().start(120)
    timer().setRemaining(45)
    expect(remaining()).toBe(45)
    expect(timer().totalSeconds).toBe(45)
  })

  it('skip makes it idle and removes the stored timer', () => {
    timer().start(60)
    expect(localStorage.getItem(KEY)).not.toBeNull()
    timer().skip()
    expect(timer().endsAt).toBeNull()
    expect(timer().workoutId).toBeNull()
    expect(timer().totalSeconds).toBe(0)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('derives remaining from the clock with no interval running', () => {
    timer().start(100)
    vi.setSystemTime(T0 + 30_000)
    expect(remaining()).toBe(70)
    vi.setSystemTime(T0 + 99_500)
    expect(remaining()).toBe(1)
  })

  describe('end callback', () => {
    it('fires once at endsAt, then goes idle', () => {
      const play = vi.spyOn(chime, 'playRestChime')
      const buzz = vi.spyOn(chime, 'vibrateRestEnd')
      timer().start(30)
      vi.advanceTimersByTime(29_999)
      expect(play).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(play).toHaveBeenCalledTimes(1)
      expect(buzz).toHaveBeenCalledTimes(1)
      expect(timer().endsAt).toBeNull()
      vi.advanceTimersByTime(60_000)
      expect(play).toHaveBeenCalledTimes(1)
    })

    it('does not fire after a skip', () => {
      const play = vi.spyOn(chime, 'playRestChime')
      timer().start(30)
      timer().skip()
      vi.advanceTimersByTime(60_000)
      expect(play).not.toHaveBeenCalled()
    })

    it('fires at the new endsAt after setRemaining', () => {
      const play = vi.spyOn(chime, 'playRestChime')
      timer().start(30)
      timer().setRemaining(90)
      vi.advanceTimersByTime(30_000)
      expect(play).not.toHaveBeenCalled()
      vi.advanceTimersByTime(60_000)
      expect(play).toHaveBeenCalledTimes(1)
    })

    it('keeps a running rest when the page becomes visible before endsAt', () => {
      timer().start(30)
      vi.setSystemTime(T0 + 10_000)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(timer().endsAt).toBe(T0 + 30_000)
    })

    it('clears silently when the page becomes visible after endsAt', () => {
      const play = vi.spyOn(chime, 'playRestChime')
      timer().start(30)
      vi.setSystemTime(T0 + 45_000)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(timer().endsAt).toBeNull()
      expect(play).not.toHaveBeenCalled()
    })
  })

  describe('persistence', () => {
    it('restores a future same-workout timer after a reload', () => {
      timer().start(120)
      vi.setSystemTime(T0 + 40_000)
      __resetRestTimerForTests() // simulated reload: re-reads localStorage
      expect(timer().workoutId).toBe('w1')
      expect(remaining()).toBe(80)
      expect(timer().totalSeconds).toBe(120)
      timer().reconcile('w1')
      expect(timer().endsAt).not.toBeNull()
    })

    it('rearms the end timeout when reconcile keeps a timer', () => {
      const play = vi.spyOn(chime, 'playRestChime')
      timer().start(60)
      __resetRestTimerForTests()
      timer().reconcile('w1')
      vi.advanceTimersByTime(60_000)
      expect(play).toHaveBeenCalledTimes(1)
    })

    it('clears a timer that belongs to another workout', () => {
      timer().start(120)
      __resetRestTimerForTests()
      timer().reconcile('other')
      expect(timer().endsAt).toBeNull()
      expect(localStorage.getItem(KEY)).toBeNull()
    })

    it('clears an expired timer on reconcile', () => {
      timer().start(10)
      vi.setSystemTime(T0 + 20_000)
      __resetRestTimerForTests()
      timer().reconcile('w1')
      expect(timer().endsAt).toBeNull()
      expect(localStorage.getItem(KEY)).toBeNull()
    })

    it('clears a stored timer when there is no workout', () => {
      timer().start(120)
      __resetRestTimerForTests()
      timer().reconcile(null)
      expect(timer().endsAt).toBeNull()
    })

    it('ignores corrupt JSON and wrong shapes', () => {
      localStorage.setItem(KEY, '{not json')
      expect(() => __resetRestTimerForTests()).not.toThrow()
      expect(timer().endsAt).toBeNull()
      localStorage.setItem(KEY, JSON.stringify({ workoutId: 1, endsAt: 'x' }))
      __resetRestTimerForTests()
      expect(timer().endsAt).toBeNull()
    })
  })
})

describe('useRestRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    __resetRestTimerForTests()
    seedSession()
  })

  afterEach(() => {
    cleanup() // unmount before the store reset below, so it is not an unwrapped update
    vi.useRealTimers()
    __resetRestTimerForTests()
    useSessionStore.setState({ workout: null, exercises: [] })
  })

  it('is idle with no rest', () => {
    const { result } = renderHook(() => useRestRemaining())
    expect(result.current).toEqual({ remaining: 0, total: 0, resting: false })
  })

  it('ticks from the wall clock while resting', () => {
    const { result } = renderHook(() => useRestRemaining())
    act(() => timer().start(90))
    expect(result.current).toEqual({ remaining: 90, total: 90, resting: true })
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toEqual({ remaining: 60, total: 90, resting: true })
  })

  it('reads idle at 0:00 for a past endsAt that has not been cleared yet', () => {
    // A frozen background tab: the end timeout has not run, but the clock has moved on.
    useRestTimerStore.setState({ workoutId: 'w1', endsAt: T0 - 1000, totalSeconds: 60 })
    const { result } = renderHook(() => useRestRemaining())
    expect(result.current.remaining).toBe(0)
    expect(result.current.resting).toBe(false)
  })
})
