import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetAudioForTests,
  playRestChime,
  unlockAudio,
  vibrateRestEnd,
} from '@/lib/restChime'
import { __resetRestTimerForTests, useRestTimerStore } from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'

function installFakeAudio(state: AudioContextState = 'running') {
  const oscillators: { frequency: { value: number }; start: ReturnType<typeof vi.fn> }[] = []
  const resume = vi.fn(() => Promise.resolve())
  class FakeAudioContext {
    state = state
    currentTime = 0
    destination = {}
    resume = resume
    createOscillator() {
      const oscillator = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(oscillator)
      return oscillator
    }
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return { oscillators, resume }
}

describe('restChime', () => {
  beforeEach(() => {
    __resetAudioForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetRestTimerForTests()
    useSessionStore.setState({ workout: null })
  })

  it('is a silent no-op when AudioContext and vibrate are absent', () => {
    expect('AudioContext' in window).toBe(false)
    expect(() => {
      unlockAudio()
      playRestChime()
      vibrateRestEnd()
    }).not.toThrow()
  })

  it('plays two tones (880 and 1320 Hz)', () => {
    const { oscillators } = installFakeAudio()
    playRestChime()
    expect(oscillators.map((o) => o.frequency.value)).toEqual([880, 1320])
    oscillators.forEach((o) => expect(o.start).toHaveBeenCalledTimes(1))
  })

  it('unlockAudio resumes a suspended context', () => {
    const { resume } = installFakeAudio('suspended')
    unlockAudio()
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('vibrates [200,100,200]', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    vibrateRestEnd()
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200])
  })

  it('swallows a throwing vibrate', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      vibrate: () => {
        throw new Error('blocked')
      },
    })
    expect(() => vibrateRestEnd()).not.toThrow()
  })

  it('the end timeout plays the chime and vibrates once', () => {
    vi.useFakeTimers()
    const { oscillators } = installFakeAudio()
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    __resetRestTimerForTests()

    useRestTimerStore.getState().start(15)
    vi.advanceTimersByTime(15_000)

    expect(oscillators).toHaveLength(2)
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200])
  })
})
