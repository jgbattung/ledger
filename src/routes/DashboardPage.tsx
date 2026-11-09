import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { programs, WorkoutInProgressError, type ProgramTree } from '@/db/repos'
import { UpNextCard } from '@/components/programs/UpNextCard'
import { buttonVariants } from '@/components/ui/button'
import { passState } from '@/programs/model'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/sessionStore'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

function NoActiveProgram() {
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-3.5">
      <p className="text-xs font-medium text-muted-foreground">No active program</p>
      <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
        Activate a program to see your next workout here.
      </p>
      <Link
        to="/workout"
        className={cn(buttonVariants({ variant: 'secondary' }), 'h-12 w-full text-base')}
      >
        Go to Workout
      </Link>
    </div>
  )
}

export function DashboardPage() {
  const [trees, setTrees] = useState<ProgramTree[] | null>(null)
  const [starting, setStarting] = useState(false)
  const navigate = useNavigate()
  const { workout } = useInProgressWorkout()

  const startDay = async (programId: string, dayId: string) => {
    if (starting) return
    setStarting(true)
    try {
      await useSessionStore.getState().start(programId, dayId)
      navigate('/session')
    } catch (error) {
      if (error instanceof WorkoutInProgressError) navigate('/session')
      else setStarting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void programs.listTrees().then((loaded) => {
      if (!cancelled) setTrees(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(async () => {
    setTrees(await programs.listTrees())
  }, [])

  // A second tap before the reload lands would act on stale state.
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const save = async (write: () => Promise<unknown>) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      await write()
      await reload()
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const active = trees?.find((tree) => tree.program.isActive && !tree.program.isArchived)
  const nextIndex = active
    ? passState(
        active.days.map(({ day }) => day),
        active.program.completedDayIds,
      ).nextIndex
    : -1

  return (
    <div className="pt-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {trees === null ? (
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      ) : !active || nextIndex === -1 ? (
        <NoActiveProgram />
      ) : (
        <UpNextCard
          tree={active}
          saving={saving}
          starting={starting}
          ongoing={workout != null}
          ongoingDayId={workout?.programDayId ?? null}
          onStart={(dayId) => void startDay(active.program.id, dayId)}
          onCompleteRestDay={(dayId) =>
            void save(() => programs.completeDay(active.program.id, dayId))
          }
        />
      )}
    </div>
  )
}
