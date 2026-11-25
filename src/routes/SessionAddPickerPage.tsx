import { Navigate } from 'react-router-dom'
import { AddExercisePicker } from '@/components/session/AddExercisePicker'
import { useGoBack } from '@/lib/useGoBack'
import { useSessionStore } from '@/stores/sessionStore'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

/**
 * Multi-select picker that adds exercises to the in-progress workout
 * (`/session/add`, LOG-11). The selection and the position live in the
 * session store so they survive a trip to the create form or an exercise
 * page. Back adds nothing.
 */
export function SessionAddPickerPage() {
  const { workout, ready } = useInProgressWorkout()
  const exercises = useSessionStore((state) => state.exercises)
  const focusedId = useSessionStore((state) => state.focusedExerciseId)
  const selection = useSessionStore((state) => state.addSelection)
  const addPosition = useSessionStore((state) => state.addPosition)
  const goBack = useGoBack('/session')

  if (!ready) return null
  if (!workout) return <Navigate to="/session" replace />

  return (
    <AddExercisePicker
      title={`Add to ${workout.name}`}
      onBack={() => {
        useSessionStore.getState().clearAddPicks()
        goBack()
      }}
      exercises={exercises}
      focusedId={focusedId}
      selection={selection}
      onTogglePick={(ref) => useSessionStore.getState().toggleAddPick(ref)}
      addPosition={addPosition}
      onPositionChange={(next) => useSessionStore.getState().setAddPosition(next)}
      onAdd={(refs, position) => useSessionStore.getState().addExercises(refs, position)}
      onAdded={goBack}
      pickOrigin="session"
    />
  )
}
