import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import { ExerciseSearchPanel } from '@/components/library/ExerciseSearchPanel'
import { SwapModeSheet } from '@/components/session/SwapModeSheet'
import type { Exercise } from '@/exercises/types'
import { useGoBack } from '@/lib/useGoBack'
import { exerciseName, formatTargets } from '@/programs/model'
import { useSessionStore } from '@/stores/sessionStore'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

/**
 * Single-select swap picker (`/session/swap/:workoutExerciseId`, LOG-10).
 * Exercises already in the workout are disabled. Picking one opens the
 * Keep / Reset sheet; Back and closing that sheet both cancel.
 */
export function SwapPickerPage() {
  const { workoutExerciseId } = useParams()
  const { workout, ready } = useInProgressWorkout()
  const exercises = useSessionStore((state) => state.exercises)
  const goBack = useGoBack('/session')
  const [picked, setPicked] = useState<Exercise | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready) return null
  const entry = exercises.find((e) => e.exercise.id === workoutExerciseId)
  const swappable = entry && !entry.sets.some((set) => set.completedAt != null)
  if (!workout || !entry || !swappable) return <Navigate to="/session" replace />

  const inWorkout = new Set(
    exercises.flatMap((e) =>
      e.exercise.exerciseRef.source === 'db' ? [e.exercise.exerciseRef.exerciseId] : [],
    ),
  )
  const fromName = exerciseName(entry.exercise.exerciseRef)
  const snapshot = entry.exercise.targetsSnapshot

  const choose = async (mode: 'keep' | 'reset') => {
    if (!picked || busy) return
    setBusy(true)
    try {
      await useSessionStore.getState().swap(entry.exercise.id, { source: 'db', exerciseId: picked.id }, mode)
      goBack()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ExerciseSearchPanel
        header={
          <header className="flex h-[52px] items-center gap-2">
            <BackLink onBack={goBack} label="Back" />
            <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
              Swap exercise
            </h1>
            <span aria-hidden="true" className="size-touch-min shrink-0" />
          </header>
        }
        renderRow={(exercise) => {
          const already = inWorkout.has(exercise.id)
          return (
            <button
              type="button"
              disabled={already}
              onClick={() => setPicked(exercise)}
              className="block w-full rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ExerciseListItem
                exercise={exercise}
                muted={already}
                subtitle={already ? 'Already in this workout' : undefined}
              />
            </button>
          )
        }}
      />
      <SwapModeSheet
        open={picked !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPicked(null)
        }}
        toName={picked?.name ?? ''}
        fromName={fromName}
        keepSummary={snapshot ? formatTargets(snapshot) : null}
        busy={busy}
        onChoose={(mode) => void choose(mode)}
      />
    </>
  )
}
