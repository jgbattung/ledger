import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { MuscleFigure } from '@/components/library/MuscleFigure'
import {
  MUSCLE_CROP,
  MUSCLE_GROUPS,
  MUSCLE_VIEW,
  type BodyHalf,
} from '@/components/library/muscleGroups'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { formatFilterValue } from '@/exercises/filtering'
import type { Muscle } from '@/exercises/types'
import { cn } from '@/lib/utils'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'

type Step = 'primary' | 'secondary'

const store = useCustomExerciseFormStore.getState

const BADGE =
  'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold text-background'

const COPY: Record<Step, { caption: string; title: string; help: string }> = {
  primary: {
    caption: 'Step 1 of 2',
    title: 'Primary muscles',
    help: 'What this exercise mainly trains. Pick at least one.',
  },
  secondary: {
    caption: 'Step 2 of 2',
    title: 'Secondary muscles',
    help: 'Optional. Muscles that help.',
  },
}

type NavState = { depth?: number; flow?: boolean } | null

/**
 * The two-step muscle page of the custom exercise form (LG-007, 2b and 2c):
 * primary then secondary, a figure tile per muscle, an Upper body / Lower body
 * switch. Picks write straight into the form draft.
 */
export function MusclePickerPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const mode = useCustomExerciseFormStore((s) => s.mode)
  const step: Step = searchParams.get('step') === 'secondary' ? 'secondary' : 'primary'
  const basePath = id ? `/exercises/custom/${id}/edit` : '/exercises/new'

  // A refresh or a direct link lost the draft: go back to the form.
  if (mode === null) return <Navigate to={basePath} replace />

  return <MuscleStep key={step} step={step} basePath={basePath} />
}

function MuscleStep({ step, basePath }: { step: Step; basePath: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { depth = 1, flow = false } = (location.state as NavState) ?? {}

  const primary = useCustomExerciseFormStore((s) => s.draft.primaryMuscles)
  const secondary = useCustomExerciseFormStore((s) => s.draft.secondaryMuscles)
  const picks = step === 'primary' ? primary : secondary

  // Opens on the half holding the first existing pick, otherwise Upper body.
  const [half, setHalf] = useState<BodyHalf>(() => (picks[0] ? MUSCLE_CROP[picks[0]] : 'upper'))

  const copy = COPY[step]
  const countIn = (which: BodyHalf) => picks.filter((m) => MUSCLE_CROP[m] === which).length

  const toggle = (muscle: Muscle) => {
    const next = picks.includes(muscle) ? picks.filter((m) => m !== muscle) : [...picks, muscle]
    if (step === 'primary') store().setPrimaryMuscles(next)
    else store().setSecondaryMuscles(next)
  }

  const goBack = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(basePath, { replace: true })
  }

  // The step entries leave history, so Back from the form never re-enters them.
  const done = () => {
    if (location.key !== 'default') navigate(-depth)
    else navigate(basePath, { replace: true })
  }

  const next = () =>
    navigate(`${basePath}/muscles?step=secondary`, { state: { depth: depth + 1, flow: true } })

  const isNext = step === 'primary' && flow
  const disabled = step === 'primary' && primary.length === 0

  const halfLabel = (which: BodyHalf, label: string) => {
    const count = countIn(which)
    return (
      <>
        {label}
        {count > 0 ? (
          <span className={cn(BADGE, 'ml-1.5')} aria-label={`${count} selected`}>
            {count}
          </span>
        ) : null}
      </>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center px-4">
        <BackLink onBack={goBack} label="Back" />
      </header>

      <div className="shrink-0 px-4">
        <p className="text-sm text-muted-foreground">{copy.caption}</p>
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{copy.help}</p>
        <SegmentedControl
          aria-label="Body half"
          className="mt-3"
          value={half}
          onValueChange={setHalf}
          options={[
            { value: 'upper', label: halfLabel('upper', 'Upper body') },
            { value: 'lower', label: halfLabel('lower', 'Lower body') },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {MUSCLE_GROUPS[half].map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="pt-3.5 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {group.label}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {group.muscles.map((muscle) => {
                const isPrimary = step === 'secondary' && primary.includes(muscle)
                const picked = picks.includes(muscle)
                return (
                  <button
                    key={muscle}
                    type="button"
                    aria-pressed={picked}
                    disabled={isPrimary}
                    onClick={() => toggle(muscle)}
                    className={cn(
                      'relative flex min-h-touch-primary flex-col items-center gap-1 rounded-lg border bg-background px-1 pt-2 pb-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      picked ? 'border-2 border-foreground px-0 pt-[7px] pb-[5px]' : 'border-border',
                      isPrimary && 'bg-muted',
                    )}
                  >
                    <MuscleFigure
                      highlight={[muscle]}
                      crop={half}
                      view={MUSCLE_VIEW[muscle]}
                      className="h-[74px] w-[58px]"
                    />
                    <span
                      className={cn(
                        'text-center text-xs leading-tight font-medium',
                        isPrimary && 'text-muted-foreground',
                      )}
                    >
                      {formatFilterValue(muscle)}
                    </span>
                    {isPrimary ? (
                      <span
                        className={cn(BADGE, 'absolute top-1.5 right-1.5 bg-muted-foreground')}
                        title="Primary muscle"
                      >
                        P
                      </span>
                    ) : picked && step === 'secondary' ? (
                      <span className={cn(BADGE, 'absolute top-1.5 right-1.5')}>S</span>
                    ) : picked ? (
                      <span className={cn(BADGE, 'absolute top-1.5 right-1.5')} aria-hidden="true">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="shrink-0 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <button
          type="button"
          disabled={disabled}
          onClick={isNext ? next : done}
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground"
        >
          {isNext ? 'Next' : 'Done'}
        </button>
      </footer>
    </div>
  )
}
