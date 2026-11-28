import { useEffect, useRef, useState } from 'react'
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Ellipsis, Plus } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { EditExerciseSheet } from '@/components/session/EditExerciseSheet'
import { ExerciseNoteCard } from '@/components/session/ExerciseNoteCard'
import { NumberPad } from '@/components/session/NumberPad'
import { SetTable } from '@/components/session/SetTable'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { FieldError } from '@/components/ui/field-error'
import { exercisePath } from '@/exercises/detail'
import { exerciseName } from '@/programs/model'
import { useUnit } from '@/settings/SettingsProvider'
import { workoutEditAddPath, workoutEditPath, workoutPath } from '@/lib/paths'
import { useGoBack } from '@/lib/useGoBack'
import { cn } from '@/lib/utils'
import type { SessionExercise } from '@/stores/sessionStore'
import {
  selectEmptySetCount,
  selectIsDirty,
  useWorkoutEditStore,
  type EditLoadResult,
} from '@/stores/workoutEditStore'

const FOOTER_BUTTON =
  'inline-flex h-12 min-w-0 flex-1 items-center justify-center rounded-md text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60'

const store = useWorkoutEditStore.getState

/** The number pad bound to the edit store. */
function EditNumberPad() {
  const pad = useWorkoutEditStore((state) => state.pad)
  const activeSet = useWorkoutEditStore((state) =>
    state.pad
      ? state.draft?.exercises.flatMap((entry) => entry.sets).find((row) => row.id === state.pad?.setId)
      : undefined,
  )
  return (
    <NumberPad
      pad={pad}
      activeSet={activeSet}
      onKey={(key) => store().padKey(key)}
      onRir={(setId, rir, plus) => store().setRir(setId, rir, plus)}
      onNext={() => store().padNext()}
      onClose={() => store().closePad()}
    />
  )
}

/**
 * Edit a finished workout (`/workouts/:workoutId/edit`, LG-015). One scrolling
 * page over an in-memory draft: nothing reaches Dexie until Save.
 */
export function WorkoutEditPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const unit = useUnit()
  const goBack = useGoBack(workoutId ? workoutPath(workoutId) : '/')
  const [status, setStatus] = useState<EditLoadResult | 'loading'>('loading')
  const draft = useWorkoutEditStore((state) => state.draft)
  const pad = useWorkoutEditStore((state) => state.pad)
  const previousByExercise = useWorkoutEditStore((state) => state.previousByExercise)
  const openSwipeSetId = useWorkoutEditStore((state) => state.openSwipeSetId)
  const saving = useWorkoutEditStore((state) => state.saving)
  const error = useWorkoutEditStore((state) => state.error)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dirty = useWorkoutEditStore(selectIsDirty)
  const emptySets = useWorkoutEditStore(selectEmptySetCount)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [emptyOpen, setEmptyOpen] = useState(false)

  // The picker, the create form and exercise pages are detours that return
  // here, so they never count as leaving. Leaving clean drops the draft so the
  // next visit starts fresh; the post-Save replace is never blocked because
  // save() resets the store (clean) before navigating.
  const editBase = workoutId ? workoutEditPath(workoutId) : ''
  const blocker = useBlocker(({ nextLocation }) => {
    const inside =
      nextLocation.pathname.startsWith(`${editBase}/add`) ||
      nextLocation.pathname.startsWith('/exercises/')
    const dirtyNow = selectIsDirty(store())
    if (!inside && !dirtyNow) store().reset()
    return dirtyNow && !inside
  })
  // Snapshot of the exercise the actions sheet was opened for (it outlives the exercise on removal).
  const [moreEntry, setMoreEntry] = useState<SessionExercise | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!workoutId) return
    let cancelled = false
    void store()
      .load(workoutId)
      .then((result) => {
        if (!cancelled) setStatus(result)
      })
    return () => {
      cancelled = true
    }
  }, [workoutId])

  // Keep the cell being edited above the docked pad.
  const padSetId = pad?.setId
  const padField = pad?.entry.field
  useEffect(() => {
    if (!padSetId) return
    const frame = requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector<HTMLElement>('[role="row"] button[aria-current="true"]')
        ?.scrollIntoView?.({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [padSetId, padField])

  if (!workoutId || status === 'missing') return <Navigate to="/" replace />
  if (status === 'in_progress') return <Navigate to="/session" replace />
  if (status === 'loading' || !draft) return <div className="min-h-full" aria-busy="true" />

  const { workout, exercises } = draft
  const started = new Date(workout.startedAt)
  const meta = [workout.programName, format(started, 'EEE d MMM'), format(started, 'h:mm a')]
    .filter(Boolean)
    .join(' · ')

  const save = async () => {
    if (await store().save()) navigate(workoutPath(workoutId), { replace: true })
  }
  const requestSave = () => {
    if (emptySets > 0) setEmptyOpen(true)
    else void save()
  }
  // Back and Cancel: ask first when there is something to lose.
  const requestLeave = () => {
    if (dirty) setDiscardOpen(true)
    else goBack()
  }
  const blocked = blocker.state === 'blocked'

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackLink onBack={requestLeave} label="Back" />
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">Edit workout</h1>
        <span aria-hidden="true" className="size-touch-min shrink-0" />
      </header>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4"
        onPointerDownCapture={(event) => {
          // Tapping anywhere but the revealed remove button closes a swiped row.
          if (openSwipeSetId && !(event.target as HTMLElement).closest('[data-swipe-row="open"] button')) {
            store().setSwipeOpen(null)
          }
        }}
      >
        <div className="px-4 pt-0.5">
          <h2 className="text-xl leading-tight font-semibold">{workout.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{meta}</p>
        </div>

        <ExerciseNoteCard
          label="Workout note"
          placeholder="How did it go?"
          value={workout.notes ?? ''}
          onChange={(value) => store().setWorkoutNote(value)}
        />

        <div className="mt-5">
          {exercises.map(({ exercise, sets }, index) => (
            <section
              key={exercise.id}
              aria-label={exerciseName(exercise.exerciseRef)}
              className={cn('pb-4', index > 0 && 'mt-0 border-t-8 border-muted')}
            >
              <div className="flex items-center pt-3.5 pr-1 pl-4">
                <h3 className="min-w-0 flex-1 text-lg leading-tight font-semibold">
                  {exerciseName(exercise.exerciseRef)}
                </h3>
                <button
                  type="button"
                  aria-label={`${exerciseName(exercise.exerciseRef)} actions`}
                  onClick={() => {
                    setMoreEntry({ exercise, sets })
                    setMoreOpen(true)
                  }}
                  className="flex size-touch-min shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Ellipsis className="size-5" aria-hidden="true" />
                </button>
              </div>
              <SetTable
                sets={sets}
                previous={previousByExercise[exercise.id] ?? []}
                snapshot={exercise.targetsSnapshot}
                pad={pad}
                onOpenPad={(setId, field, side) => store().openPad(setId, field, side, unit)}
                onAddSet={() => store().addSet(exercise.id)}
                openSwipeSetId={openSwipeSetId}
                onSwipeOpenChange={(setId) => store().setSwipeOpen(setId)}
                onRemove={(setId) => store().removeSet(setId)}
              />
              <ExerciseNoteCard
                programNote={exercise.targetsSnapshot?.notes}
                value={exercise.notes ?? ''}
                onChange={(value) => store().setExerciseNote(exercise.id, value)}
              />
            </section>
          ))}
        </div>

        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={() => navigate(workoutEditAddPath(workoutId))}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add exercise
          </button>
        </div>
      </div>

      <EditNumberPad />
      {moreEntry ? (
        <EditExerciseSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          entry={moreEntry}
          isOnly={exercises.length <= 1}
          onInfo={() => navigate(exercisePath(moreEntry.exercise.exerciseRef))}
          onRemove={() => {
            try {
              store().removeExercise(moreEntry.exercise.id)
            } catch {
              // The sheet already refuses the last exercise.
            }
          }}
        />
      ) : null}
      {pad ? null : (
        <footer className="shrink-0 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {error ? <FieldError alert message="Couldn't save. Try again." className="mt-0 pb-2" /> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={requestLeave}
              className={cn(FOOTER_BUTTON, 'border border-border bg-background text-foreground hover:bg-muted')}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={requestSave}
              className={cn(FOOTER_BUTTON, 'bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              Save
            </button>
          </div>
        </footer>
      )}

      <ConfirmSheet
        open={discardOpen || blocked}
        onOpenChange={(open) => {
          if (open) return
          setDiscardOpen(false)
          if (blocked) blocker.reset()
        }}
        title="Discard your changes?"
        description="Your edits to this workout aren't saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          setDiscardOpen(false)
          store().reset()
          if (blocked) blocker.proceed()
          else goBack()
        }}
      />
      <ConfirmSheet
        open={emptyOpen}
        onOpenChange={setEmptyOpen}
        title={`Save without ${emptySets} empty ${emptySets === 1 ? 'set' : 'sets'}?`}
        description="Sets with no reps aren't saved."
        confirmLabel="Save workout"
        cancelLabel="Keep editing"
        tone="neutral"
        onConfirm={() => {
          setEmptyOpen(false)
          void save()
        }}
      />
    </div>
  )
}
