/** The workout summary page (LG-014). */
export const workoutPath = (id: string) => `/workouts/${id}`

/** The edit page of a finished workout (LG-015). */
export const workoutEditPath = (id: string) => `/workouts/${id}/edit`

/** The add-exercise picker of the edit page (LG-015). */
export const workoutEditAddPath = (id: string) => `/workouts/${id}/edit/add`

/** The share-image preview for a workout (LG-014). */
export const workoutSharePath = (id: string) => `/workouts/${id}/share`
