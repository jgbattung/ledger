import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { NewExerciseButton } from '@/components/library/NewExerciseButton'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import { ExerciseSearchPanel } from '@/components/library/ExerciseSearchPanel'
import { SwapModeSheet } from '@/components/session/SwapModeSheet'
import { filterExercises } from '@/exercises/filtering'
import { refKey } from '@/exercises/listing'
import type { ListedExercise } from '@/exercises/listing'
import { useGoBack } from '@/lib/useGoBack'
import { exerciseName, formatTargets } from '@/programs/model'
import { selectLive, useCustomExerciseStore } from '@/stores/customExerciseStore'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'
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
  const [picked, setPicked] = useState<ListedExercise | null>(null)
  const [busy, setBusy] = useState(false)

  // A custom exercise just created from this picker opens the Keep / Reset
  // sheet straight away (decision D).
  useEffect(() => {
    const pending = useCustomExerciseFormStore.getState().consumePendingPick()
    if (!pending) return
    const custom = selectLive(useCustomExerciseStore.getState())
    const listed = filterExercises('', { muscle: null, category: null, equipment: null }, custom).find(
      (e) => refKey(e.ref) === refKey(pending),
    )
    if (listed) setPicked(listed)
  }, [])

  if (!ready) return null
  const entry = exercises.find((e) => e.exercise.id === workoutExerciseId)
  const swappable = entry && !entry.sets.some((set) => set.completedAt != null)
  if (!workout || !entry || !swappable) return <Navigate to="/session" replace />

  const inWorkout = new Set(exercises.map((e) => refKey(e.exercise.exerciseRef)))
  const fromName = exerciseName(entry.exercise.exerciseRef)
  const snapshot = entry.exercise.targetsSnapshot

  const choose = async (mode: 'keep' | 'reset') => {
    if (!picked || busy) return
    setBusy(true)
    try {
      await useSessionStore.getState().swap(entry.exercise.id, picked.ref, mode)
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
            <NewExerciseButton to="/exercises/new?pick=swap" />
          </header>
        }
        createHref={(query) => `/exercises/new?pick=swap&name=${encodeURIComponent(query)}`}
        renderRow={(exercise) => {
          const already = inWorkout.has(refKey(exercise.ref))
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
