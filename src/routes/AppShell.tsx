import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'
import { QuickActionSheet } from '@/components/QuickActionSheet'

export function AppShell() {
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      {/*
        The bottom padding clears the bar (--touch-primary), the FAB's raise
        above it (--fab-raise), the gesture inset, and a resting gap - so the
        last row of a scrolled list can never sit under the FAB.
      */}
      <main className="flex-1 overflow-y-auto px-4 pb-[calc(var(--touch-primary)+var(--fab-raise)+env(safe-area-inset-bottom)+1rem)]">
        <Outlet />
      </main>
      <BottomNav onQuickActions={() => setQuickActionsOpen(true)} />
      <QuickActionSheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen} />
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
