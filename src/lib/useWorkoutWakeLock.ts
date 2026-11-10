import { useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Keeps the screen awake while a workout is in progress (LG-017 §5). The
 * sentinel lives at module level, so the two shells (tabbed and chromeless)
 * can each mount the hook across route changes without double-acquiring.
 * Chrome drops the lock whenever the page is hidden, so it is re-requested
 * when the page is visible again. Everything is feature-detected; rejections
 * (NotAllowedError, low battery) are ignored.
 */
let sentinel: WakeLockSentinel | null = null
let requesting = false
let holders = 0

function request() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
  if (requesting || (sentinel && !sentinel.released)) return
  requesting = true
  void navigator.wakeLock
    .request('screen')
    .then((lock) => {
      requesting = false
      if (holders === 0) {
        void lock.release().catch(() => {})
        return
      }
      sentinel = lock
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null
      })
    })
    .catch(() => {
      requesting = false
    })
}

function release() {
  const lock = sentinel
  sentinel = null
  if (lock && !lock.released) void lock.release().catch(() => {})
}

export function useWorkoutWakeLock() {
  const active = useSessionStore((state) => state.workout != null)

  useEffect(() => {
    if (!active) return
    holders += 1
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    onVisible()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      holders -= 1
      // Deferred, so a shell swap (unmount then mount in one commit) keeps the same lock.
      setTimeout(() => {
        if (holders === 0) release()
      }, 0)
    }
  }, [active])
}

/** Test-only: forget module state between tests. */
export function __resetWakeLockForTests() {
  sentinel = null
  requesting = false
  holders = 0
}
