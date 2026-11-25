import { Navigate, useParams } from 'react-router-dom'
import { AddExercisePicker } from '@/components/session/AddExercisePicker'
import { workoutEditPath } from '@/lib/paths'
import { useGoBack } from '@/lib/useGoBack'
import { useWorkoutEditStore } from '@/stores/workoutEditStore'

/** The edit page shows the sets a workout exercise holds, not session progress. */
const setsLine = ({ sets }: { sets: unknown[] }) => `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`

/**
 * Multi-select picker that adds exercises to the workout being edited
 * (`/workouts/:workoutId/edit/add`). Like the session picker, the selection
 * and position live in the store so they survive a trip to the create form or
 * an exercise page. Back adds nothing. Without a draft for this id it sends
 * the user back to the edit page, which loads one.
 */
export function WorkoutEditAddPickerPage() {
  const { workoutId } = useParams()
  const draft = useWorkoutEditStore((state) => state.draft)
  const owner = useWorkoutEditStore((state) => state.workoutId)
  const selection = useWorkoutEditStore((state) => state.addSelection)
  const addPosition = useWorkoutEditStore((state) => state.addPosition)
  const goBack = useGoBack(workoutId ? workoutEditPath(workoutId) : '/')

  if (!workoutId || !draft || owner !== workoutId) {
    return <Navigate to={workoutId ? workoutEditPath(workoutId) : '/'} replace />
  }
  const store = useWorkoutEditStore.getState

  return (
    <AddExercisePicker
      title={`Add to ${draft.workout.name}`}
      onBack={() => {
        store().clearAddPicks()
        goBack()
      }}
      exercises={draft.exercises}
      focusedId={null}
      selection={selection}
      onTogglePick={(ref) => store().toggleAddPick(ref)}
      addPosition={addPosition}
      onPositionChange={(next) => store().setAddPosition(next)}
      onAdd={(refs, position) => store().addExercises(refs, position)}
      onAdded={goBack}
      pickOrigin="edit"
      formatProgress={setsLine}
    />
  )
}
