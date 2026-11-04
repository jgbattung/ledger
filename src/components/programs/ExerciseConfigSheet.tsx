import { useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { FIELD_CLASS } from '@/components/ui/text-field-sheet'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  exerciseName,
  restDigitsToSeconds,
  secondsToRestDigits,
  type DraftExercise,
  type ExerciseTargets,
} from '@/programs/model'
import { useSettings } from '@/settings/SettingsProvider'

type ExerciseConfigSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: DraftExercise | null
  dayName: string
  /** Activation gate message, shown above the fields. */
  notice?: string
  onSave: (targets: ExerciseTargets) => void
}

type FieldKey = 'sets' | 'repMin' | 'repMax' | 'rir' | 'rest' | 'warmups'
type Errors = Partial<Record<'sets' | 'reps' | 'rir' | 'rest' | 'warmups', string>>

const MAX_SETS = 20
const MAX_REPS = 100
const MAX_RIR = 5
const MIN_REST = 15
const MAX_REST = 600
const MAX_WARMUPS = 5

const digitsOnly = (value: string) => value.replace(/\D/g, '')

/** Digits entered timer-style, shown as m:ss ("230" -> "2:30"); blank stays blank. */
function restDisplay(digits: string): string {
  if (digits === '') return ''
  const padded = digits.padStart(4, '0')
  return `${Number(padded.slice(0, 2))}:${padded.slice(2)}`
}

const parse = (value: string): number | undefined => (value === '' ? undefined : Number(value))
const outside = (n: number | undefined, min: number, max: number) =>
  n !== undefined && (n < min || n > max)

/** Bottom-sheet form for an exercise's seven PROG-4 targets (Screen I). */
export function ExerciseConfigSheet({
  open,
  onOpenChange,
  exercise,
  dayName,
  notice,
  onSave,
}: ExerciseConfigSheetProps) {
  const setsRef = useRef<HTMLInputElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...(notice ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          setsRef.current?.focus()
        }}
      >
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle className="truncate text-[15px] font-semibold">
              {exercise ? exerciseName(exercise.exerciseRef) : 'Exercise'}
            </SheetTitle>
            <p className="truncate text-xs text-muted-foreground">{dayName}</p>
          </div>
        </SheetHeader>
        {notice ? (
          <SheetDescription className="shrink-0 px-4 pb-3 text-destructive">
            {notice}
          </SheetDescription>
        ) : null}
        {/* Mounted only while open (Radix unmounts closed content), so the
            local state re-seeds from the exercise every time it opens. */}
        {exercise ? (
          <ConfigForm
            exercise={exercise}
            setsRef={setsRef}
            onSubmit={(targets) => {
              onSave(targets)
              onOpenChange(false)
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ConfigForm({
  exercise,
  setsRef,
  onSubmit,
}: {
  exercise: DraftExercise
  setsRef: RefObject<HTMLInputElement | null>
  onSubmit: (targets: ExerciseTargets) => void
}) {
  const { settings } = useSettings()
  const ids = useId()

  const [sets, setSets] = useState(exercise.workingSets?.toString() ?? '')
  const [repMin, setRepMin] = useState(exercise.repMin?.toString() ?? '')
  const [repMax, setRepMax] = useState(exercise.repMax?.toString() ?? '')
  const [rir, setRir] = useState(exercise.rirTarget?.toString() ?? '')
  const [rest, setRest] = useState(secondsToRestDigits(exercise.restSeconds))
  const [warmups, setWarmups] = useState(exercise.warmupSetCount?.toString() ?? '')
  const [notes, setNotes] = useState(exercise.notes ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const repMinRef = useRef<HTMLInputElement>(null)
  const repMaxRef = useRef<HTMLInputElement>(null)
  const rirRef = useRef<HTMLInputElement>(null)
  const restRef = useRef<HTMLInputElement>(null)
  const warmupsRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const refs: Record<FieldKey, RefObject<HTMLInputElement | null>> = {
    sets: setsRef,
    repMin: repMinRef,
    repMax: repMaxRef,
    rir: rirRef,
    rest: restRef,
    warmups: warmupsRef,
  }
  // Tab order, for "next" on the keypad and for focusing the first invalid field.
  const order: FieldKey[] = ['sets', 'repMin', 'repMax', 'rir', 'rest', 'warmups']

  const next = (key: FieldKey) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const following = order[order.indexOf(key) + 1]
    if (following) refs[following].current?.focus()
    else notesRef.current?.focus()
  }

  const submit = () => {
    const setsN = parse(sets)
    let minN = parse(repMin)
    let maxN = parse(repMax)
    const rirN = parse(rir)
    const restN = restDigitsToSeconds(rest)
    const warmupsN = parse(warmups)

    const found: Errors = {}
    if (outside(setsN, 1, MAX_SETS)) found.sets = `Enter 1 to ${MAX_SETS}.`
    if (outside(minN, 1, MAX_REPS) || outside(maxN, 1, MAX_REPS)) {
      found.reps = `Enter 1 to ${MAX_REPS}.`
    } else if (minN !== undefined && maxN !== undefined && minN > maxN) {
      found.reps = "Min can't be more than max."
    }
    if (outside(rirN, 0, MAX_RIR)) found.rir = `Enter 0 to ${MAX_RIR}.`
    if (outside(restN, MIN_REST, MAX_REST)) {
      found.rest = `Enter ${formatSeconds(MIN_REST)} to ${formatSeconds(MAX_REST)}.`
    }
    if (outside(warmupsN, 0, MAX_WARMUPS)) found.warmups = `Enter 0 to ${MAX_WARMUPS}.`

    setErrors(found)
    if (Object.keys(found).length > 0) {
      const firstInvalid = order.find((key) => {
        if (key === 'repMin' || key === 'repMax') return found.reps
        if (key === 'sets') return found.sets
        return found[key]
      })
      if (firstInvalid) refs[firstInvalid].current?.focus()
      return
    }

    // A single rep value is a fixed count.
    if (minN === undefined) minN = maxN
    if (maxN === undefined) maxN = minN
    onSubmit({
      workingSets: setsN,
      repMin: minN,
      repMax: maxN,
      rirTarget: rirN,
      restSeconds: restN,
      warmupSetCount: warmupsN,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-[1fr_2.2fr] items-start gap-3">
          <NumberField
            label="Sets"
            value={sets}
            placeholder="–"
            inputRef={setsRef}
            error={errors.sets}
            errorId={`${ids}-sets`}
            onChange={(v) => setSets(digitsOnly(v))}
            onKeyDown={next('sets')}
          />
          <div role="group" aria-labelledby={`${ids}-reps`} className="flex flex-col gap-1.5">
            <span id={`${ids}-reps`} className="text-sm text-muted-foreground">
              Reps
            </span>
            <div className="flex items-center gap-2">
              <NumberInput
                ariaLabel="Rep min"
                value={repMin}
                placeholder="–"
                inputRef={repMinRef}
                invalid={Boolean(errors.reps)}
                describedBy={errors.reps ? `${ids}-reps-error` : undefined}
                onChange={(v) => setRepMin(digitsOnly(v))}
                onKeyDown={next('repMin')}
              />
              <span aria-hidden="true" className="text-muted-foreground">
                –
              </span>
              <NumberInput
                ariaLabel="Rep max"
                value={repMax}
                placeholder="–"
                inputRef={repMaxRef}
                invalid={Boolean(errors.reps)}
                describedBy={errors.reps ? `${ids}-reps-error` : undefined}
                onChange={(v) => setRepMax(digitsOnly(v))}
                onKeyDown={next('repMax')}
              />
            </div>
            <FieldError id={`${ids}-reps-error`} message={errors.reps} />
          </div>
        </div>

        <div className="grid grid-cols-3 items-start gap-3">
          <NumberField
            label="RIR"
            value={rir}
            placeholder="0"
            inputRef={rirRef}
            error={errors.rir}
            errorId={`${ids}-rir`}
            onChange={(v) => setRir(digitsOnly(v))}
            onKeyDown={next('rir')}
          />
          <NumberField
            label="Rest"
            value={restDisplay(rest)}
            placeholder={settings ? formatSeconds(settings.defaultRestSeconds) : ''}
            inputRef={restRef}
            error={errors.rest}
            errorId={`${ids}-rest`}
            onChange={(v) => setRest(digitsOnly(v).replace(/^0+/, '').slice(-4))}
            onKeyDown={next('rest')}
          />
          <NumberField
            label="Warm-ups"
            value={warmups}
            placeholder={settings ? String(settings.defaultWarmupSetCount) : ''}
            inputRef={warmupsRef}
            error={errors.warmups}
            errorId={`${ids}-warmups`}
            onChange={(v) => setWarmups(digitsOnly(v))}
            onKeyDown={next('warmups')}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Notes</span>
          <textarea
            ref={notesRef}
            value={notes}
            rows={3}
            placeholder="Optional"
            onChange={(event) => setNotes(event.target.value)}
            className={cn(FIELD_CLASS, 'min-h-touch-min resize-none py-3')}
          />
        </label>
      </div>

      <div className="shrink-0 px-4 pt-2 pb-4">
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Save
        </button>
      </div>
    </form>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}

function NumberInput({
  id,
  ariaLabel,
  value,
  placeholder,
  inputRef,
  invalid,
  describedBy,
  onChange,
  onKeyDown,
}: {
  id?: string
  ariaLabel?: string
  value: string
  placeholder: string
  inputRef: RefObject<HTMLInputElement | null>
  invalid: boolean
  describedBy?: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent) => void
}) {
  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint="next"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      className={cn(
        FIELD_CLASS,
        'min-h-touch-min min-w-0 tabular-nums',
        invalid && 'border-destructive',
      )}
    />
  )
}

function NumberField({
  label,
  error,
  errorId,
  ...input
}: {
  label: string
  error?: string
  errorId: string
  value: string
  placeholder: string
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent) => void
}) {
  const inputId = `${errorId}-input`
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        {label}
      </label>
      <NumberInput
        {...input}
        id={inputId}
        invalid={Boolean(error)}
        describedBy={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  )
}
