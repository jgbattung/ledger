import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'

export function AppShell() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto px-4 pb-[calc(var(--touch-primary)+env(safe-area-inset-bottom)+1rem)]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

/**
 * Layout for full-screen takeovers that own the whole viewport - no bottom nav,
 * no space reserved for one. LG-010's Ongoing Workout mounts inside this and
 * changes no shell code.
 */
export function ChromelessShell() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
