import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CircleSlash } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { ExerciseThumb } from '@/components/ExerciseThumb'
import { programs, WorkoutInProgressError } from '@/db/repos'
import { exercisePath } from '@/exercises/detail'
import type { ProgramTree } from '@/db/repos'
import { DeletedPill } from '@/components/library/DeletedPill'
import { exerciseName, formatTargets, isDeletedExercise, isRestDay, programTreeToDraft } from '@/programs/model'
import type { DraftDay } from '@/programs/model'
import { useGoBack } from '@/lib/useGoBack'
import { useSessionStore } from '@/stores/sessionStore'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

type Loaded = { programId: string; programName: string; day: DraftDay } | 'unavailable' | null

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function resolve(tree: ProgramTree | undefined, dayId: string | undefined): Loaded {
  if (!tree || tree.program.isArchived) return 'unavailable'
  const draft = programTreeToDraft(tree)
  const day = draft.days.find((d) => d.id === dayId)
  if (!day || isRestDay(day)) return 'unavailable'
  return { programId: draft.id, programName: draft.name, day }
}

/** Screen B: read-only review of a program day with a thumb-zone Start. */
export function DayPage() {
  const { programId, dayId } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [starting, setStarting] = useState(false)
  const { workout } = useInProgressWorkout()

  useEffect(() => {
    let cancelled = false
    void (programId ? programs.loadTree(programId) : Promise.resolve(undefined)).then((tree) => {
      if (!cancelled) setLoaded(resolve(tree, dayId))
    })
    return () => {
      cancelled = true
    }
  }, [programId, dayId])

  const start = async () => {
    if (!loaded || loaded === 'unavailable' || starting) return
    if (workout) {
      navigate('/session')
      return
    }
    setStarting(true)
    try {
      await useSessionStore.getState().start(loaded.programId, loaded.day.id)
      navigate('/session')
    } catch (error) {
      if (error instanceof WorkoutInProgressError) navigate('/session')
      else setStarting(false)
    }
  }

  const day = loaded && loaded !== 'unavailable' ? loaded.day : null
  const workingSets = day?.exercises.reduce((sum, e) => sum + (e.workingSets ?? 1), 0) ?? 0

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackLink onBack={goBack} label="Back" />
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
          {day ? day.name : loaded === 'unavailable' ? 'Workout' : ''}
        </h1>
        <span aria-hidden="true" className="size-touch-min shrink-0" />
      </header>

      {loaded === 'unavailable' ? (
        <div className="px-4 pt-24 text-center">
          <div className="mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CircleSlash className="size-6" aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold">This day can&apos;t be started</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            It may be a rest day, or the program was archived or removed.
          </p>
        </div>
      ) : day && loaded ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 pt-1 pb-3">
              <p className="text-xs font-medium text-muted-foreground">{loaded.programName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {plural(day.exercises.length, 'exercise')} · {plural(workingSets, 'working set')}
              </p>
            </div>
            <ul className="border-t border-border">
              {day.exercises.map((exercise) => {
                const targets = formatTargets(exercise)
                return (
                  <li key={exercise.id} className="border-b border-border">
                    <Link
                      to={exercisePath(exercise.exerciseRef)}
                      className="flex min-h-18 w-full items-center gap-3 px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                    >
                      <ExerciseThumb exerciseRef={exercise.exerciseRef} className="size-12 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-base leading-snug">
                          {exerciseName(exercise.exerciseRef)}
                          {isDeletedExercise(exercise.exerciseRef) ? <DeletedPill className="align-[1px]" /> : null}
                        </p>
                        {targets ? (
                          <p className="text-sm text-muted-foreground tabular-nums">{targets}</p>
                        ) : (
                          <span className="mt-0.5 inline-block rounded-full border border-dashed border-muted-foreground px-2 text-[13px] text-muted-foreground">
                            No targets · starts with 1 set
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="shrink-0 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <button
              type="button"
              onClick={() => void start()}
              disabled={starting}
              className="flex h-touch-primary w-full items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
            >
              {workout ? 'Resume workout' : 'Start workout'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
