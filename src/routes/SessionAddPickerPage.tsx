import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { ExerciseSearchPanel } from '@/components/library/ExerciseSearchPanel'
import { NewExerciseButton } from '@/components/library/NewExerciseButton'
import { PickerRow } from '@/components/library/PickerRow'
import { PickerTray } from '@/components/programs/PickerTray'
import { AddPositionSheet } from '@/components/session/AddPositionSheet'
import type { InsertPosition } from '@/db/repos/workoutExercises'
import { filterExercises } from '@/exercises/filtering'
import { refKey } from '@/exercises/listing'
import { useGoBack } from '@/lib/useGoBack'
import { exerciseName } from '@/programs/model'
import { selectLive, useCustomExerciseStore } from '@/stores/customExerciseStore'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

/**
 * Multi-select picker that adds exercises to the in-progress workout
 * (`/session/add`, LOG-11). The circle selects (the name opens the exercise
 * page); the selection and the position live in the session store so they
 * survive a trip to the create form or an exercise page. Back adds nothing.
 */
export function SessionAddPickerPage() {
  const { workout, ready } = useInProgressWorkout()
  const exercises = useSessionStore((state) => state.exercises)
  const focusedId = useSessionStore((state) => state.focusedExerciseId)
  const selection = useSessionStore((state) => state.addSelection)
  const addPosition = useSessionStore((state) => state.addPosition)
  const goBack = useGoBack('/session')
  const [positionOpen, setPositionOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const custom = useCustomExerciseStore(selectLive)
  const listedByKey = useMemo(
    () =>
      new Map(
        filterExercises('', { muscle: null, category: null, equipment: null }, custom).map((e) => [
          refKey(e.ref),
          e,
        ]),
      ),
    [custom],
  )

  // A custom exercise just created from this picker arrives as a pending pick.
  useEffect(() => {
    const pending = useCustomExerciseFormStore.getState().consumePendingPick()
    if (!pending) return
    const picks = useSessionStore.getState()
    if (!picks.addSelection.some((r) => refKey(r) === refKey(pending))) picks.toggleAddPick(pending)
  }, [])

  // Coming back from an exercise page, drop picks that are no longer live.
  useEffect(() => {
    const picks = useSessionStore.getState()
    for (const ref of picks.addSelection) {
      if (!listedByKey.has(refKey(ref))) picks.toggleAddPick(ref)
    }
  }, [listedByKey])

  if (!ready) return null
  if (!workout) return <Navigate to="/session" replace />

  const inWorkout = new Set(exercises.map((e) => refKey(e.exercise.exerciseRef)))
  const selectedKeys = selection.map(refKey)
  const selectedExercises = selectedKeys.flatMap((key) => {
    const exercise = listedByKey.get(key)
    return exercise ? [exercise] : []
  })

  // An anchor that is gone falls back to the end.
  const anchor =
    addPosition.kind === 'after'
      ? exercises.find((e) => e.exercise.id === addPosition.workoutExerciseId)
      : undefined
  const position: InsertPosition =
    addPosition.kind === 'after' && !anchor ? { kind: 'end' } : addPosition
  const positionLabel =
    position.kind === 'start'
      ? 'At the start'
      : anchor && position.kind === 'after'
        ? `After ${exerciseName(anchor.exercise.exerciseRef)}`
        : 'At the end'

  const back = () => {
    useSessionStore.getState().clearAddPicks()
    goBack()
  }

  const add = async () => {
    if (busy || selection.length === 0) return
    setBusy(true)
    try {
      if (await useSessionStore.getState().addExercises(selection, position)) goBack()
    } finally {
      setBusy(false)
    }
  }

  const count = selection.length

  return (
    <>
      <ExerciseSearchPanel
        header={
          <header className="flex h-[52px] items-center gap-2">
            <BackLink onBack={back} label="Back" />
            <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
              Add to {workout.name}
            </h1>
            <NewExerciseButton to="/exercises/new?pick=session" />
          </header>
        }
        createHref={(query) => `/exercises/new?pick=session&name=${encodeURIComponent(query)}`}
        renderRow={(exercise) => {
          const key = refKey(exercise.ref)
          const already = inWorkout.has(key)
          return (
            <PickerRow
              exercise={exercise}
              multi
              order={selectedKeys.indexOf(key) + 1}
              disabled={already}
              subtitle={already ? 'Already in this workout' : undefined}
              onSelect={() => useSessionStore.getState().toggleAddPick(exercise.ref)}
            />
          )
        }}
        footer={
          count > 0 ? (
            <div className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <PickerTray
                selected={selectedExercises}
                onDeselect={(key) => {
                  const ref = selection.find((r) => refKey(r) === key)
                  if (ref) useSessionStore.getState().toggleAddPick(ref)
                }}
              />
              <button
                type="button"
                onClick={() => setPositionOpen(true)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-md bg-muted px-3 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="text-muted-foreground">Add</span>
                <span className="min-w-0 flex-1 truncate text-right font-medium">{positionLabel}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void add()}
                className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
              >
                Add {count} {count === 1 ? 'exercise' : 'exercises'}
              </button>
            </div>
          ) : null
        }
      />
      <AddPositionSheet
        open={positionOpen}
        onOpenChange={setPositionOpen}
        exercises={exercises}
        focusedId={focusedId}
        value={position}
        onSelect={(next) => useSessionStore.getState().setAddPosition(next)}
      />
    </>
  )
}
