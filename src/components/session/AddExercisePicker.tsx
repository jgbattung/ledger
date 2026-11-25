import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { ExerciseSearchPanel } from '@/components/library/ExerciseSearchPanel'
import { NewExerciseButton } from '@/components/library/NewExerciseButton'
import { PickerRow } from '@/components/library/PickerRow'
import { PickerTray } from '@/components/programs/PickerTray'
import { AddPositionSheet } from '@/components/session/AddPositionSheet'
import type { InsertPosition } from '@/db/repos/workoutExercises'
import type { ExerciseRef } from '@/db/types'
import { filterExercises } from '@/exercises/filtering'
import { refKey } from '@/exercises/listing'
import { exerciseName } from '@/programs/model'
import { selectLive, useCustomExerciseStore } from '@/stores/customExerciseStore'
import { useCustomExerciseFormStore, type PickOrigin } from '@/stores/customExerciseFormStore'
import type { SessionExercise } from '@/stores/sessionStore'

/**
 * The multi-select picker that adds exercises to a workout (LOG-11), bound to
 * no store: the live session and the past-workout edit page each pass their
 * own selection, position and handlers. The circle selects (the name opens
 * the exercise page). Back adds nothing.
 */
export function AddExercisePicker({
  title,
  onBack,
  exercises,
  focusedId,
  selection,
  onTogglePick,
  addPosition,
  onPositionChange,
  onAdd,
  onAdded,
  pickOrigin,
  formatProgress,
}: {
  title: string
  onBack: () => void
  /** The workout's exercises, in order: they are disabled in the list and anchor the position sheet. */
  exercises: SessionExercise[]
  focusedId: string | null
  selection: ExerciseRef[]
  onTogglePick: (ref: ExerciseRef) => void
  addPosition: InsertPosition
  onPositionChange: (position: InsertPosition) => void
  /** Adds the picked exercises. Resolves true when they were added. */
  onAdd: (selection: ExerciseRef[], position: InsertPosition) => Promise<boolean>
  /** Called after a successful add. */
  onAdded: () => void
  pickOrigin: PickOrigin
  /** Overrides the per-row line of the position sheet. */
  formatProgress?: (entry: SessionExercise, current: boolean) => string
}) {
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

  const live = useRef({ selection, onTogglePick })
  live.current = { selection, onTogglePick }

  // A custom exercise just created from this picker arrives as a pending pick.
  useEffect(() => {
    const pending = useCustomExerciseFormStore.getState().consumePendingPick()
    if (!pending) return
    const { selection: current, onTogglePick: toggle } = live.current
    if (!current.some((r) => refKey(r) === refKey(pending))) toggle(pending)
  }, [])

  // Coming back from an exercise page, drop picks that are no longer live.
  useEffect(() => {
    const { selection: current, onTogglePick: toggle } = live.current
    for (const ref of current) {
      if (!listedByKey.has(refKey(ref))) toggle(ref)
    }
  }, [listedByKey])

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

  const add = async () => {
    if (busy || selection.length === 0) return
    setBusy(true)
    try {
      if (await onAdd(selection, position)) onAdded()
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
            <BackLink onBack={onBack} label="Back" />
            <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{title}</h1>
            <NewExerciseButton to={`/exercises/new?pick=${pickOrigin}`} />
          </header>
        }
        createHref={(query) => `/exercises/new?pick=${pickOrigin}&name=${encodeURIComponent(query)}`}
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
              onSelect={() => onTogglePick(exercise.ref)}
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
                  if (ref) onTogglePick(ref)
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
        onSelect={onPositionChange}
        formatProgress={formatProgress}
      />
    </>
  )
}
