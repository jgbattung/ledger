/**
 * Records hit this session (LOG-12). LG-027 wires in REC-3 detection and fills
 * this slot; until then it renders nothing (no "No new records" placeholder).
 */
export function WorkoutRecords({ workoutId }: { workoutId: string }) {
  void workoutId
  return null
}
