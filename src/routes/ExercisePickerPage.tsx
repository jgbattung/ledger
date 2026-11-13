import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { NewExerciseButton } from '@/components/library/NewExerciseButton'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import { ExerciseSearchPanel } from '@/components/library/ExerciseSearchPanel'
import { PickerTray } from '@/components/programs/PickerTray'
import { filterExercises } from '@/exercises/filtering'
import { refKey } from '@/exercises/listing'
import { selectLive, useCustomExerciseStore } from '@/stores/customExerciseStore'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'
import { useProgramDraftStore } from '@/stores/programDraftStore'
import { cn } from '@/lib/utils'

/**
 * Multi-select exercise picker for one day of the draft. Tap rows to toggle;
 * the check shows the add order. Back adds nothing; "Add N exercises" appends
 * the selection in order and returns to the editor.
 */
export function ExercisePickerPage() {
  const { programId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const draft = useProgramDraftStore((s) => s.draft)

  // Ordered refs picked so far (selection order = add order), kept in the draft
  // store so they survive a trip to the create form.
  const selection = useProgramDraftStore((s) => s.pickerSelection)
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

  // A custom exercise just created from this picker arrives as a pending pick:
  // add it to the selection, keeping everything picked before.
  useEffect(() => {
    const pending = useCustomExerciseFormStore.getState().consumePendingPick()
    if (!pending) return
    const picks = useProgramDraftStore.getState()
    if (!picks.pickerSelection.some((r) => refKey(r) === refKey(pending))) picks.togglePick(pending)
  }, [])

  const editorPath = programId ? `/programs/${programId}` : '/programs/new'
  const dayId = searchParams.get('day')
  const day = draft?.days.find((d) => d.id === dayId)
  const routeMatches = draft && (programId ? draft.id === programId : draft.isNew)

  // No draft (e.g. after a reload) or an unknown day: the editor re-initialises.
  if (!draft || !day || !routeMatches) return <Navigate to={editorPath} replace />

  const inDay = new Set(day.exercises.map((e) => refKey(e.exerciseRef)))
  const selectedKeys = selection.map(refKey)
  const selectedExercises = selectedKeys.flatMap((key) => {
    const exercise = listedByKey.get(key)
    return exercise ? [exercise] : []
  })

  const add = () => {
    const store = useProgramDraftStore.getState()
    store.addExercises(day.id, selection)
    store.clearPicks()
    navigate(-1)
  }

  const back = () => {
    useProgramDraftStore.getState().clearPicks()
    navigate(-1)
  }

  const count = selection.length

  return (
    <ExerciseSearchPanel
      header={
        <header className="flex h-[52px] items-center gap-2">
          <BackLink onBack={back} label="Back" />
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
            Add to {day.name}
          </h1>
          <NewExerciseButton to="/exercises/new?pick=program" />
        </header>
      }
      createHref={(query) => `/exercises/new?pick=program&name=${encodeURIComponent(query)}`}
      renderRow={(exercise) => {
        const key = refKey(exercise.ref)
        const already = inDay.has(key)
        const order = selectedKeys.indexOf(key) + 1
        const picked = order > 0
        return (
          <button
            type="button"
            aria-pressed={already ? undefined : picked}
            disabled={already}
            onClick={() => useProgramDraftStore.getState().togglePick(exercise.ref)}
            className="block w-full rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ExerciseListItem
              exercise={exercise}
              muted={already}
              subtitle={already ? `Already in ${day.name}` : undefined}
              trailing={
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold tabular-nums',
                    picked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : already
                        ? 'border-dashed border-border'
                        : 'border-border',
                  )}
                >
                  {picked ? order : null}
                </span>
              }
            />
          </button>
        )
      }}
      footer={
        count > 0 ? (
          <div className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <PickerTray
              selected={selectedExercises}
              onDeselect={(key) => {
                const ref = selection.find((r) => refKey(r) === key)
                if (ref) useProgramDraftStore.getState().togglePick(ref)
              }}
            />
            <button
              type="button"
              onClick={add}
              className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Add {count} {count === 1 ? 'exercise' : 'exercises'}
            </button>
          </div>
        ) : null
      }
    />
  )
}
