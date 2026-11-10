import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetWakeLockForTests, useWorkoutWakeLock } from '@/lib/useWorkoutWakeLock'
import { useSessionStore } from '@/stores/sessionStore'

function Probe() {
  useWorkoutWakeLock()
  return null
}

function installWakeLock() {
  const sentinels: { released: boolean; release: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn>; fire: () => void }[] = []
  const request = vi.fn(async () => {
    let onRelease: (() => void) | undefined
    const sentinel = {
      released: false,
      release: vi.fn(async () => {
        sentinel.released = true
      }),
      addEventListener: vi.fn((_: string, cb: () => void) => {
        onRelease = cb
      }),
      fire: () => {
        sentinel.released = true
        onRelease?.()
      },
    }
    sentinels.push(sentinel)
    return sentinel
  })
  vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
  return { request, sentinels }
}

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useWorkoutWakeLock', () => {
  beforeEach(() => {
    __resetWakeLockForTests()
    useSessionStore.setState({ workout: null })
  })

  afterEach(() => {
    setVisibility('visible')
  })

  it('requests once when a workout appears', async () => {
    const { request } = installWakeLock()
    render(<Probe />)
    expect(request).not.toHaveBeenCalled()
    act(() => useSessionStore.setState({ workout: { id: 'w1' } as never }))
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('does not request again on a second mount', async () => {
    const { request } = installWakeLock()
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    render(<Probe />)
    await flush()
    render(<Probe />)
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('keeps the same lock when one shell unmounts and another mounts', async () => {
    const { request, sentinels } = installWakeLock()
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    const first = render(<Probe />)
    await flush()
    first.unmount()
    render(<Probe />)
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
    expect(sentinels[0].released).toBe(false)
  })

  it('re-requests after a hidden then visible cycle', async () => {
    const { request, sentinels } = installWakeLock()
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    render(<Probe />)
    await flush()
    setVisibility('hidden')
    sentinels[0].fire() // the browser drops the lock when the page hides
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases when the workout clears', async () => {
    const { sentinels } = installWakeLock()
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    render(<Probe />)
    await flush()
    act(() => useSessionStore.setState({ workout: null }))
    await flush()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })

  it('does not request while the page is hidden, then requests once visible', async () => {
    const { request } = installWakeLock()
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    setVisibility('hidden')
    render(<Probe />)
    await flush()
    expect(request).not.toHaveBeenCalled()
    setVisibility('visible')
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('releases when the last holder unmounts', async () => {
    const { sentinels } = installWakeLock()
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    const view = render(<Probe />)
    await flush()
    view.unmount()
    await flush()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })

  it('releases a lock that resolves after the workout has ended', async () => {
    let resolveLock: (lock: unknown) => void = () => {}
    const lock = { released: false, release: vi.fn(async () => {}), addEventListener: vi.fn() }
    const request = vi.fn(() => new Promise((resolve) => (resolveLock = resolve)))
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    render(<Probe />)
    act(() => useSessionStore.setState({ workout: null }))
    await flush()
    resolveLock(lock)
    await flush()
    expect(lock.release).toHaveBeenCalledTimes(1)
    expect(lock.addEventListener).not.toHaveBeenCalled()
  })

  it('is a no-op when wakeLock is absent', async () => {
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    expect('wakeLock' in navigator).toBe(false)
    expect(() => render(<Probe />)).not.toThrow()
    await flush()
  })

  it('ignores a rejected request', async () => {
    const request = vi.fn(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
    useSessionStore.setState({ workout: { id: 'w1' } as never })
    render(<Probe />)
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
  })
})
