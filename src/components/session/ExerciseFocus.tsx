import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Flame, Info, Target } from 'lucide-react'
import { ExerciseNoteCard } from '@/components/session/ExerciseNoteCard'
import { SetTable } from '@/components/session/SetTable'
import { TargetsSheet } from '@/components/session/TargetsSheet'
import { exerciseName } from '@/programs/model'
import { repPlaceholder } from '@/workouts/model'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/sessionStore'
import type { SessionExercise } from '@/stores/sessionStore'

// The button is a 44px tap target; the visible 36px pill is its inner span (design-system 10: 44px minimum).
const CHIP =
  'group flex h-touch-min shrink-0 items-center rounded-full text-sm font-medium outline-none'
const PILL =
  'flex h-9 items-center gap-1.5 rounded-full border px-3 group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50'

/** "Set 2 of 3 · 8–10 reps · RIR 1" from the snapshot; "All sets done" once every set is checked. */
function subtitle({ exercise, sets }: SessionExercise): string {
  if (sets.length === 0) return 'No sets'
  if (sets.every((set) => set.completedAt != null)) return 'All sets done'
  const current = sets.findIndex((set) => set.completedAt == null) + 1
  const snapshot = exercise.targetsSnapshot
  const parts = [`Set ${current} of ${sets.length}`]
  const reps = repPlaceholder(snapshot)
  if (reps) parts.push(`${reps} reps`)
  // Matches formatTargets: complete targets default the RIR target to 0.
  if (reps) parts.push(`RIR ${snapshot?.rirTarget ?? 0}`)
  return parts.join(' · ')
}

/** The focused exercise: header, chips, set table and note card. */
export function ExerciseFocus({ entry }: { entry: SessionExercise }) {
  const navigate = useNavigate()
  const [targetsOpen, setTargetsOpen] = useState(false)
  const [swapHint, setSwapHint] = useState(false)
  const pad = useSessionStore((state) => state.pad)
  const openSwipeSetId = useSessionStore((state) => state.openSwipeSetId)
  const previous = useSessionStore((state) => state.previousByExercise[entry.exercise.id])
  const { exercise, sets } = entry

  const name = exerciseName(exercise.exerciseRef)
  const canSwap = !sets.some((set) => set.completedAt != null)

  return (
    <div>
      <div className="px-4 pt-3.5">
        <h2 className="text-xl leading-tight font-semibold tracking-tight">{name}</h2>
        {exercise.swappedFrom ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Swapped from {exerciseName(exercise.swappedFrom)}
          </p>
        ) : null}
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{subtitle(entry)}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pt-1 pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          aria-disabled={!canSwap}
          onClick={() => {
            if (canSwap) navigate(`/session/swap/${exercise.id}`)
            else setSwapHint((value) => !value)
          }}
          className={CHIP}
        >
          <span className={cn(PILL, 'border-border', !canSwap && 'border-dashed text-muted-foreground')}>
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Swap
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTargetsOpen(true)}
          className={CHIP}
        >
          <span className={cn(PILL, 'border-border')}>
            <Target className="size-4" aria-hidden="true" />
            Targets
          </span>
        </button>
        <button
          type="button"
          disabled
          className={CHIP}
        >
          <span className={cn(PILL, 'border-dashed border-muted-foreground text-muted-foreground')}>
            <Flame className="size-4" aria-hidden="true" />
            Warm Up
          </span>
        </button>
        <button
          type="button"
          disabled
          className={CHIP}
        >
          <span className={cn(PILL, 'border-dashed border-muted-foreground text-muted-foreground')}>
            <Info className="size-4" aria-hidden="true" />
            Info
          </span>
        </button>
      </div>
      {swapHint && !canSwap ? (
        <p role="status" className="px-4 pt-1 text-[13px] text-muted-foreground">
          Swap is only available before any set of this exercise is checked.
        </p>
      ) : null}

      <SetTable
        sets={sets}
        previous={previous ?? []}
        snapshot={exercise.targetsSnapshot}
        pad={pad}
        onOpenPad={(setId, field) => useSessionStore.getState().openPad(setId, field)}
        onToggle={(setId) => useSessionStore.getState().toggleComplete(setId)}
        onAddSet={() => void useSessionStore.getState().addSet(exercise.id)}
        openSwipeSetId={openSwipeSetId}
        onSwipeOpenChange={(setId) => useSessionStore.getState().setSwipeOpen(setId)}
        onRemove={(setId) => useSessionStore.getState().removeSet(setId)}
      />

      <ExerciseNoteCard
        programNote={exercise.targetsSnapshot?.notes}
        value={exercise.notes ?? ''}
        onChange={(value) => useSessionStore.getState().setExerciseNote(exercise.id, value)}
      />

      <TargetsSheet
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        exerciseName={name}
        snapshot={exercise.targetsSnapshot}
      />
    </div>
  )
}
