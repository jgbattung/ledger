import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, CircleSlash } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { EQUIPMENT_OPTIONS } from '@/components/library/equipmentOptions'
import { MuscleSummaryRow } from '@/components/library/MuscleSummaryRow'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { FieldError } from '@/components/ui/field-error'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FIELD_CLASS } from '@/components/ui/text-field-sheet'
import type { ExerciseRef } from '@/db/types'
import { getAllExercises } from '@/exercises/catalog'
import { exercisePath } from '@/exercises/detail'
import { formatFilterValue, normalize } from '@/exercises/filtering'
import type { Equipment, Mechanic } from '@/exercises/types'
import { useGoBack } from '@/lib/useGoBack'
import { cn } from '@/lib/utils'
import {
  selectLive,
  useCustomExerciseStore,
  type CustomExerciseInput,
} from '@/stores/customExerciseStore'
import {
  selectIsDirty,
  useCustomExerciseFormStore,
  type FormDraft,
  type PickOrigin,
} from '@/stores/customExerciseFormStore'

const store = useCustomExerciseFormStore.getState

const MECHANIC_OPTIONS = [
  { value: 'compound', label: 'Compound' },
  { value: 'isolation', label: 'Isolation' },
] as const

type Errors = { name?: string; primary?: string; mechanic?: string }

/** The first message per field; the order is the on-screen order. */
function validate(draft: FormDraft, takenNames: Set<string>): Errors {
  const errors: Errors = {}
  const name = draft.name.trim()
  if (!name) errors.name = 'Enter a name.'
  else if (takenNames.has(normalize(name))) errors.name = 'An exercise with this name already exists.'
  if (draft.primaryMuscles.length === 0) errors.primary = 'Pick at least one primary muscle.'
  if (!draft.mechanic) errors.mechanic = 'Choose compound or isolation.'
  return errors
}

function parseRef(value: string | null): ExerciseRef | undefined {
  const [source, ...rest] = (value ?? '').split(':')
  const exerciseId = rest.join(':')
  if ((source === 'db' || source === 'custom') && exerciseId) return { source, exerciseId }
  return undefined
}

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor?: string
  children: string
  optional?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-muted-foreground">
      {children}
      {optional ? ' (optional)' : ''}
    </label>
  )
}

/**
 * Full-screen create / edit / duplicate form for a custom exercise (LG-007).
 * Edits an in-memory draft; Save is always enabled and names every problem
 * under its field (design-system 13). Muscles are chosen on their own page.
 */
export function CustomExerciseFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const goBack = useGoBack('/more/library')

  const isEdit = id !== undefined
  const mode = useCustomExerciseFormStore((s) => s.mode)
  const draft = useCustomExerciseFormStore((s) => s.draft)
  const live = useCustomExerciseStore(selectLive)
  const row = useCustomExerciseStore((s) => (id ? s.byId[id] : undefined))
  const missing = isEdit && (!row || row.deletedAt != null)

  const [showErrors, setShowErrors] = useState(false)
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Set once Save (or Discard) has decided to leave, so the guard lets it by.
  const leaving = useRef(false)
  // Only a fresh visit focuses the name; coming back from the muscle page must not.
  const fresh = useRef(mode === null)

  const basePath = isEdit ? `/exercises/custom/${id}/edit` : '/exercises/new'
  const blocker = useBlocker(({ nextLocation }) => {
    if (leaving.current) return false
    const inside = nextLocation.pathname.startsWith(basePath)
    const dirtyNow = selectIsDirty(store())
    if (!inside && !dirtyNow) {
      leaving.current = true
      store().reset()
    }
    return dirtyNow && !inside
  })

  // Keep a draft that already matches this route (the return from the muscle
  // page); otherwise start one. Edit of an unknown or deleted id starts nothing.
  useEffect(() => {
    if (missing) return
    const current = store()
    const matches = isEdit
      ? current.mode === 'edit' && current.editingId === id
      : current.mode === 'new' || current.mode === 'duplicate'
    if (matches) return
    const pick = searchParams.get('pick')
    const pickOrigin: PickOrigin | undefined = pick === 'program' || pick === 'swap' ? pick : undefined
    if (isEdit) {
      current.start({ mode: 'edit', editingId: id })
      return
    }
    const from = parseRef(searchParams.get('from'))
    current.start(
      from
        ? { mode: 'duplicate', from }
        : { mode: 'new', name: searchParams.get('name') ?? undefined, pickOrigin },
    )
    // Route identity only: a later reset (after Save) must not restart the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, missing])

  // Names that are taken: every bundled exercise and every live custom one
  // except the exercise being edited.
  const takenNames = useMemo(() => {
    const names = new Set(getAllExercises().map((exercise) => normalize(exercise.name)))
    for (const custom of live) if (custom.id !== id) names.add(normalize(custom.name))
    return names
  }, [live, id])

  const errors = showErrors ? validate(draft, takenNames) : {}

  const openMuscles = (step: 'primary' | 'secondary') => {
    // A row opens its own step directly once there is a primary; otherwise it
    // starts the two-step flow from the beginning.
    const direct = draft.primaryMuscles.length > 0
    const target = direct ? step : 'primary'
    navigate(`${basePath}/muscles?step=${target}`, { state: { depth: 1, flow: !direct } })
  }

  const save = async () => {
    const problems = validate(draft, takenNames)
    if (problems.name || problems.primary || problems.mechanic) {
      setShowErrors(true)
      const first = problems.name ? 'field-name' : problems.primary ? 'field-primary' : 'field-mechanic'
      requestAnimationFrame(() => {
        const target = document.getElementById(first)
        target?.scrollIntoView?.({ block: 'center' })
        if (first === 'field-name') target?.focus()
      })
      return
    }
    setBusy(true)
    setSaveError(null)
    const input: CustomExerciseInput = {
      name: draft.name.trim(),
      primaryMuscles: draft.primaryMuscles,
      secondaryMuscles: draft.secondaryMuscles,
      equipmentTag: draft.equipmentTag,
      mechanic: draft.mechanic,
      notes: draft.notes.trim() || undefined,
    }
    const exercises = useCustomExerciseStore.getState()
    try {
      if (isEdit && id) {
        await exercises.update(id, input)
        leaving.current = true
        store().reset()
        // Back to the exercise page already in history; only a cold deep link
        // (no history) replaces to it.
        if (location.key !== 'default') navigate(-1)
        else navigate(exercisePath({ source: 'custom', exerciseId: id }), { replace: true })
        return
      }
      const created = await exercises.create(input)
      const ref: ExerciseRef = { source: 'custom', exerciseId: created.id }
      const origin = store().pickOrigin
      leaving.current = true
      if (origin) {
        store().setPendingPick(ref)
        store().reset()
        navigate(-1)
      } else {
        store().reset()
        navigate(exercisePath(ref), { replace: true })
      }
    } catch {
      setSaveError("Couldn't save. Try again.")
      setBusy(false)
    }
  }

  const title = isEdit ? 'Edit exercise' : 'New exercise'

  if (missing) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-[52px] shrink-0 items-center px-4">
          <BackLink onBack={goBack} label="Back" />
        </header>
        <div className="px-4 pt-24 text-center">
          <div className="mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CircleSlash className="size-6" aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold">Exercise not found</p>
          <p className="mt-1.5 text-sm text-muted-foreground">It may have been removed from the library.</p>
        </div>
      </div>
    )
  }

  if (mode === null) return <div className="min-h-full" aria-busy="true" />

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4">
        <header className="flex h-[52px] items-center gap-2">
          <BackLink onBack={goBack} label="Back" />
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{title}</h1>
          <span className="size-touch-min shrink-0" aria-hidden="true" />
        </header>

        <div className="flex flex-col gap-5 pt-2 pb-4">
          <div>
            <Label htmlFor="field-name">Name</Label>
            <input
              id="field-name"
              type="text"
              value={draft.name}
              placeholder="e.g. SSB Squat"
              autoComplete="off"
              autoFocus={fresh.current && mode === 'new'}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'field-name-error' : undefined}
              onChange={(event) => store().setName(event.target.value)}
              className={cn(FIELD_CLASS, 'min-h-touch-min py-3', errors.name && 'border-foreground')}
            />
            <FieldError id="field-name-error" message={errors.name} alert />
          </div>

          <div id="field-primary">
            <span className="mb-1.5 block text-sm text-muted-foreground">Muscles</span>
            <MuscleSummaryRow
              first
              caption="Primary"
              muscles={draft.primaryMuscles}
              invalid={!!errors.primary}
              describedBy={errors.primary ? 'field-primary-error' : undefined}
              onClick={() => openMuscles('primary')}
            />
            <MuscleSummaryRow
              caption="Secondary"
              muscles={draft.secondaryMuscles}
              onClick={() => openMuscles('secondary')}
            />
            <FieldError id="field-primary-error" message={errors.primary} alert />
          </div>

          <div>
            <Label optional>Equipment</Label>
            <button
              type="button"
              onClick={() => setEquipmentOpen(true)}
              aria-label={`Equipment: ${draft.equipmentTag ? formatFilterValue(draft.equipmentTag) : 'None'}`}
              className="flex min-h-touch-min w-full items-center justify-between gap-2 rounded-md bg-muted px-3 text-left text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className={cn(!draft.equipmentTag && 'text-muted-foreground')}>
                {draft.equipmentTag ? formatFilterValue(draft.equipmentTag) : 'None'}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>

          <div id="field-mechanic">
            <span className="mb-1.5 block text-sm text-muted-foreground">Mechanic</span>
            <SegmentedControl
              aria-label="Mechanic"
              value={draft.mechanic ?? null}
              onValueChange={(value: Mechanic) => store().setMechanic(value)}
              options={MECHANIC_OPTIONS}
              className={cn(errors.mechanic && 'ring-1 ring-foreground')}
            />
            <FieldError id="field-mechanic-error" message={errors.mechanic} alert />
          </div>

          <div>
            <Label htmlFor="field-notes" optional>
              Notes
            </Label>
            <textarea
              id="field-notes"
              value={draft.notes}
              onChange={(event) => store().setNotes(event.target.value)}
              className={cn(FIELD_CLASS, 'min-h-24 resize-none py-3')}
            />
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <FieldError message={saveError} alert className="mt-0 pb-2" />
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        >
          Save exercise
        </button>
      </footer>

      <EquipmentSheet
        open={equipmentOpen}
        value={draft.equipmentTag}
        onOpenChange={setEquipmentOpen}
        onChoose={(value) => {
          store().setEquipmentTag(value)
          setEquipmentOpen(false)
        }}
      />

      <ConfirmSheet
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset()
        }}
        title="Discard this exercise?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          leaving.current = true
          store().reset()
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </div>
  )
}

function EquipmentSheet({
  open,
  value,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  value?: Equipment
  onOpenChange: (open: boolean) => void
  onChoose: (value: Equipment | undefined) => void
}) {
  const options: { value: Equipment | undefined; label: string }[] = [
    { value: undefined, label: 'None' },
    ...EQUIPMENT_OPTIONS.map((option) => ({ value: option, label: formatFilterValue(option) })),
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Equipment</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pb-2">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onChoose(option.value)}
              className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              {option.label}
              {option.value === value ? (
                <Check className="size-4 text-foreground" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
