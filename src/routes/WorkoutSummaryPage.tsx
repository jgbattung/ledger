import { useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { MessageSquareText, Pencil, Upload } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { LoggedSetLine } from '@/components/library/LoggedSetLine'
import { MuscleLegend, MuscleMap, WorkedMuscles } from '@/components/summary/MuscleMap'
import { WorkoutRecords } from '@/components/summary/WorkoutRecords'
import { workoutEditPath, workoutSharePath } from '@/lib/paths'
import { useGoBack } from '@/lib/useGoBack'
import { exerciseName } from '@/programs/model'
import {
  formatDuration,
  formatVolume,
  primaryMusclesOf,
  summarizeWorkout,
} from '@/workouts/summary'
import { useWorkoutSession } from '@/workouts/useWorkoutSession'

const FOOTER_BUTTON =
  'inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-md text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col-reverse border-l border-border py-3.5 pl-3 first:border-l-0 first:pl-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-xl leading-tight font-semibold whitespace-nowrap tabular-nums">
        {children}
      </dd>
    </div>
  )
}

/**
 * The workout summary (`/workouts/:workoutId`, design-system 14). Finish lands
 * here with `state.fromFinish` (Done and Back go to the Dashboard); a past
 * workout opens it from the exercise History tab (Back is history-aware).
 */
export function WorkoutSummaryPage() {
  const { workoutId } = useParams()
  const state = useWorkoutSession(workoutId)
  const location = useLocation()
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const fromFinish = (location.state as { fromFinish?: boolean } | null)?.fromFinish === true

  const session = state.status === 'ready' ? state.session : null
  const summary = useMemo(
    () => (session ? summarizeWorkout(session, primaryMusclesOf, Date.now()) : null),
    [session],
  )

  if (state.status === 'missing') return <Navigate to="/" replace />
  if (state.status === 'in_progress') return <Navigate to="/session" replace />
  if (!session || !summary) return null

  const { workout } = session
  const started = new Date(workout.startedAt)
  const meta = [workout.programName, format(started, 'EEE d MMM'), format(started, 'h:mm a')]
    .filter(Boolean)
    .join(' · ')
  const goDashboard = () => navigate('/', { replace: true })
  const share = (
    <button
      type="button"
      onClick={() => navigate(workoutSharePath(workout.id))}
      className={`${FOOTER_BUTTON} border border-border bg-background text-foreground hover:bg-muted`}
    >
      <Upload className="size-5" aria-hidden="true" />
      Share image
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between px-4">
        <BackLink onBack={fromFinish ? goDashboard : goBack} label="Back" />
        <button
          type="button"
          onClick={() => navigate(workoutEditPath(workout.id))}
          className="-mr-2 flex h-touch-min items-center gap-1.5 rounded-md px-2 text-[15px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-0.5">
          <h1 className="text-2xl leading-tight font-semibold">{workout.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{meta}</p>
          {workout.notes ? (
            <p className="mt-2.5 flex gap-1.5 text-sm">
              <MessageSquareText
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 whitespace-pre-line">{workout.notes}</span>
            </p>
          ) : null}
        </div>

        <MuscleMap setsByMuscle={summary.setsByMuscle} showViewLabels className="mx-4 mt-5" />
        {summary.workingSets > 0 ? (
          <>
            <MuscleLegend className="mx-4 mt-2.5" />
            <WorkedMuscles setsByMuscle={summary.setsByMuscle} className="mx-4 mt-2" />
          </>
        ) : null}

        <dl className="mx-4 mt-5 grid grid-cols-3 border-y border-border">
          <Stat label="Working sets">{summary.workingSets}</Stat>
          <Stat label="Volume">
            {formatVolume(summary.volumeKg)}
            <span className="ml-0.5 text-sm font-medium text-muted-foreground">kg</span>
          </Stat>
          <Stat label="Duration">{formatDuration(summary.durationMs)}</Stat>
        </dl>

        <WorkoutRecords workoutId={workout.id} />

        <h2 className="px-4 pt-6 pb-1 text-lg font-semibold">Exercises</h2>
        <ul>
          {session.exercises.map(({ exercise, sets }) => {
            const logged = sets.filter((set) => set.completedAt != null)
            const working = logged.filter((set) => set.type === 'working').length
            return (
              <li key={exercise.id} className="border-b border-border px-4 py-3">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 className="min-w-0 text-base font-medium">
                    {exerciseName(exercise.exerciseRef)}
                  </h3>
                  {working > 0 ? (
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      {working} {working === 1 ? 'set' : 'sets'}
                    </span>
                  ) : null}
                </div>
                {exercise.notes ? (
                  <p className="mb-1 text-[13px] whitespace-pre-line text-muted-foreground">
                    {exercise.notes}
                  </p>
                ) : null}
                {logged.length > 0 ? (
                  <ul>
                    {logged.map((set) => (
                      <LoggedSetLine key={set.id} set={set} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No sets logged</p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        {share}
        {fromFinish ? (
          <button
            type="button"
            onClick={goDashboard}
            className={`${FOOTER_BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            Done
          </button>
        ) : null}
      </div>
    </div>
  )
}
