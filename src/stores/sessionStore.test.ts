import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './sessionStore'

// Zustand store skeleton (AC-4). Verifies the live-session seam instantiates and
// its start/end actions mutate state as expected.
describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({ activeSessionId: null })
  })

  it('starts with no active session', () => {
    expect(useSessionStore.getState().activeSessionId).toBeNull()
  })

  it('startSession sets and endSession clears the active session id', () => {
    useSessionStore.getState().startSession('abc-123')
    expect(useSessionStore.getState().activeSessionId).toBe('abc-123')

    useSessionStore.getState().endSession()
    expect(useSessionStore.getState().activeSessionId).toBeNull()
  })
})
