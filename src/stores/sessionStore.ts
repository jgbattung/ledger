import { create } from 'zustand'

/**
 * Live-workout session seam. Empty skeleton for now - the actual set-logging
 * session state lands in a later story. Kept intentionally tiny.
 */
type SessionState = {
  activeSessionId: string | null
  startSession: (id: string) => void
  endSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessionId: null,
  startSession: (id) => set({ activeSessionId: id }),
  endSession: () => set({ activeSessionId: null }),
}))
