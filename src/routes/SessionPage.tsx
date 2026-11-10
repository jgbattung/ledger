import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ExerciseFocus } from '@/components/session/ExerciseFocus'
import { ExerciseStrip } from '@/components/session/ExerciseStrip'
import { FinishBar } from '@/components/session/FinishBar'
import { NumberPad } from '@/components/session/NumberPad'
import { WorkoutMenuSheet } from '@/components/session/WorkoutMenuSheet'
import { WorkoutNoteSheet } from '@/components/session/WorkoutNoteSheet'
import { WorkoutTopBar } from '@/components/session/WorkoutTopBar'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { getLastTab } from '@/lib/lastTab'
import { useGoBack } from '@/lib/useGoBack'
import { useSettings } from '@/settings/SettingsProvider'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

/**
 * The Ongoing Workout (`/session`). Redirects to the Workout tab when nothing
 * is in progress. Back keeps the workout running; Finish returns to the
 * Dashboard and Discard to the Workout tab.
 */
export function SessionPage() {
  const { workout, ready } = useInProgressWorkout()
  const exercises = useSessionStore((state) => state.exercises)
  const focusedId = useSessionStore((state) => state.focusedExerciseId)
  const pad = useSessionStore((state) => state.pad)
  const openSwipeSetId = useSessionStore((state) => state.openSwipeSetId)
  const goBack = useGoBack()
  const navigate = useNavigate()
  // Which way the content slides: the strip order decides (later = from the right).
  const focusIndex = exercises.findIndex((entry) => entry.exercise.id === focusedId)
  const [slide, setSlide] = useState({ id: focusedId, index: focusIndex, dir: 0 })
  if (slide.id !== focusedId) {
    setSlide({
      id: focusedId,
      index: focusIndex,
      dir: slide.id === null || focusIndex < 0 ? 0 : focusIndex > slide.index ? 1 : -1,
    })
  }
  const scrollRef = useRef<HTMLDivElement>(null)
  // Where to land once the store clears: set before finishing or discarding so
  // the redirect below does not win with its default.
  const leaveTo = useRef<string | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // The rest timer store never reads Settings: hand it the default here.
  const defaultRestSeconds = useSettings().settings?.defaultRestSeconds
  useEffect(() => {
    if (defaultRestSeconds != null) useRestTimerStore.getState().setDefaultSeconds(defaultRestSeconds)
  }, [defaultRestSeconds])

  // Notes flush on unmount (they also debounce at 400ms in the store).
  useEffect(() => () => void useSessionStore.getState().flushNotes(), [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [focusedId])

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

  if (!ready) return null
  if (!workout) return <Navigate to={leaveTo.current ?? '/workout'} replace />

  const focused = exercises.find((entry) => entry.exercise.id === focusedId) ?? exercises[0]
  const allSets = exercises.flatMap((entry) => entry.sets)
  const unchecked = allSets.filter((set) => set.completedAt == null).length
  const allDone = allSets.length > 0 && unchecked === 0

  const finish = async () => {
    leaveTo.current = '/'
    try {
      await useSessionStore.getState().finish()
    } catch {
      leaveTo.current = null
    }
  }
  const requestFinish = () => {
    setMenuOpen(false)
    if (unchecked > 0) setConfirmFinish(true)
    else void finish()
  }
  const discard = async () => {
    leaveTo.current = '/workout'
    try {
      await useSessionStore.getState().discard()
    } catch {
      leaveTo.current = null
    }
  }

  return (
    <div className="flex h-full flex-col">
      <WorkoutTopBar
        workout={workout}
        onBack={goBack}
        onMenu={() => setMenuOpen(true)}
        onRestTimer={() => {}}
      />
      <ExerciseStrip
        exercises={exercises}
        focusedId={focused?.exercise.id ?? null}
        onFocus={(id) => useSessionStore.getState().focusExercise(id)}
      />
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4"
        onPointerDownCapture={(event) => {
          // Tapping anywhere but the revealed remove button closes a swiped row.
          if (openSwipeSetId && !(event.target as HTMLElement).closest('[data-swipe-row="open"] button')) {
            useSessionStore.getState().setSwipeOpen(null)
          }
        }}
      >
        {focused ? (
          // Remounting per exercise restarts the slide on the newest target, so a rapid
          // second switch retargets cleanly instead of queueing (design-system 10l).
          <div
            key={focused.exercise.id}
            className={slide.dir !== 0 ? 'exercise-enter' : undefined}
            style={
              { '--exercise-slide-from': `calc(${slide.dir} * var(--slide-distance))` } as CSSProperties
            }
          >
            <ExerciseFocus entry={focused} />
          </div>
        ) : null}
      </div>
      <NumberPad />
      {allDone && !pad ? <FinishBar onFinish={requestFinish} /> : null}

      <WorkoutMenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={workout.name}
        subtitle={`${workout.programName ? `${workout.programName} · ` : ''}started ${format(workout.startedAt, 'h:mm a')}`}
        onFinish={requestFinish}
        onNote={() => {
          setMenuOpen(false)
          setNoteOpen(true)
        }}
        paused={workout.pausedAt != null}
        onTogglePause={() => {
          setMenuOpen(false)
          if (workout.pausedAt != null) useSessionStore.getState().resume()
          else useSessionStore.getState().pause()
        }}
        onMinimize={() => {
          setMenuOpen(false)
          navigate(getLastTab())
        }}
        onDiscard={() => {
          setMenuOpen(false)
          setConfirmDiscard(true)
        }}
      />
      <WorkoutNoteSheet open={noteOpen} onOpenChange={setNoteOpen} />
      <ConfirmSheet
        open={confirmFinish}
        onOpenChange={setConfirmFinish}
        title={`Finish with ${unchecked} ${unchecked === 1 ? 'set' : 'sets'} not done?`}
        description="Unchecked sets aren't saved."
        confirmLabel="Finish workout"
        cancelLabel="Keep logging"
        tone="neutral"
        onConfirm={() => {
          setConfirmFinish(false)
          void finish()
        }}
      />
      <ConfirmSheet
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this workout?"
        description="Nothing from it is saved to your history, and the program day stays as it was."
        confirmLabel="Discard workout"
        cancelLabel="Keep workout"
        tone="destructive"
        onConfirm={() => {
          setConfirmDiscard(false)
          void discard()
        }}
      />
    </div>
  )
}
