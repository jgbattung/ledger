import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDb } from '@/db/test-utils'
import { SettingsProvider } from '@/settings/SettingsProvider'
import type { DraftExercise } from '@/programs/model'
import { ExerciseConfigSheet } from './ExerciseConfigSheet'

const blank: DraftExercise = {
  id: 'e1',
  exerciseRef: { source: 'db', exerciseId: 'barbell-bench-press' },
}

async function setup(exercise: DraftExercise = blank, notice?: string) {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <SettingsProvider>
      <ExerciseConfigSheet
        open
        onOpenChange={onOpenChange}
        exercise={exercise}
        dayName="Push"
        notice={notice}
        onSave={onSave}
      />
    </SettingsProvider>,
  )
  const dialog = await screen.findByRole('dialog')
  // Placeholders come from Settings, which hydrates asynchronously.
  await within(dialog).findByPlaceholderText('3:00')
  return { user, onSave, onOpenChange, dialog }
}

const field = (name: string) => screen.getByRole('textbox', { name })
const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Save' }))

describe('ExerciseConfigSheet', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('shows the exercise and day names, and a blank exercise shows hints but no values', async () => {
    await setup()
    expect(screen.getByRole('heading', { name: 'Barbell Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Push')).toBeInTheDocument()

    expect(field('RIR')).toHaveValue('')
    expect(field('RIR')).toHaveAttribute('placeholder', '0')
    expect(field('Rest')).toHaveValue('')
    expect(field('Rest')).toHaveAttribute('placeholder', '3:00')
    expect(field('Warm-ups')).toHaveValue('')
    expect(field('Warm-ups')).toHaveAttribute('placeholder', '2')
    expect(field('Sets')).toHaveValue('')
    expect(field('Rep min')).toHaveValue('')
    expect(field('Rep max')).toHaveValue('')
    expect(field('Notes')).toHaveValue('')
  })

  it('focuses Sets on open', async () => {
    await setup()
    expect(field('Sets')).toHaveFocus()
  })

  it('saves every field as numbers, with timer-style rest and trimmed notes', async () => {
    const { user, onSave, onOpenChange } = await setup()
    await user.type(field('Sets'), '4')
    await user.type(field('Rep min'), '6')
    await user.type(field('Rep max'), '10')
    await user.type(field('RIR'), '2')
    await user.type(field('Rest'), '230')
    expect(field('Rest')).toHaveValue('2:30')
    await user.type(field('Warm-ups'), '1')
    await user.type(field('Notes'), '  Pause at the bottom  ')
    await save(user)

    expect(onSave).toHaveBeenCalledWith({
      workingSets: 4,
      repMin: 6,
      repMax: 10,
      rirTarget: 2,
      restSeconds: 150,
      warmupSetCount: 1,
      notes: 'Pause at the bottom',
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('seeds the fields from an already configured exercise', async () => {
    await setup({
      ...blank,
      workingSets: 3,
      repMin: 8,
      repMax: 12,
      rirTarget: 1,
      restSeconds: 90,
      warmupSetCount: 0,
      notes: 'Slow',
    })
    expect(field('Sets')).toHaveValue('3')
    expect(field('Rep min')).toHaveValue('8')
    expect(field('Rep max')).toHaveValue('12')
    expect(field('RIR')).toHaveValue('1')
    expect(field('Rest')).toHaveValue('1:30')
    expect(field('Warm-ups')).toHaveValue('0')
    expect(field('Notes')).toHaveValue('Slow')
  })

  it('rejects min above max with an inline message and does not save', async () => {
    const { user, onSave } = await setup()
    await user.type(field('Rep min'), '10')
    await user.type(field('Rep max'), '8')
    await save(user)

    expect(screen.getByText("Min can't be more than max.")).toBeInTheDocument()
    expect(field('Rep min')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Rep min')).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a single rep value as a fixed count', async () => {
    const { user, onSave } = await setup()
    await user.type(field('Sets'), '3')
    await user.type(field('Rep min'), '8')
    await save(user)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ repMin: 8, repMax: 8 }))
  })

  it('rejects sets of 0 and out-of-range optional fields', async () => {
    const { user, onSave } = await setup()
    await user.type(field('Sets'), '0')
    await user.type(field('RIR'), '9')
    await user.type(field('Warm-ups'), '7')
    await user.type(field('Rest'), '10')
    await save(user)

    expect(screen.getByText('Enter 1 to 20.')).toBeInTheDocument()
    expect(screen.getByText('Enter 0 to 5.', { selector: '[id$="-rir"]' })).toBeInTheDocument()
    expect(screen.getByText('Enter 0:15 to 10:00.')).toBeInTheDocument()
    expect(field('Sets')).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves blank optional fields as undefined', async () => {
    const { user, onSave } = await setup()
    await user.type(field('Sets'), '3')
    await user.type(field('Rep min'), '8')
    await user.type(field('Rep max'), '12')
    await save(user)

    expect(onSave).toHaveBeenCalledWith({
      workingSets: 3,
      repMin: 8,
      repMax: 12,
      rirTarget: undefined,
      restSeconds: undefined,
      warmupSetCount: undefined,
      notes: undefined,
    })
  })

  it('allows partial targets to save', async () => {
    const { user, onSave } = await setup()
    await user.type(field('Sets'), '3')
    await save(user)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workingSets: 3, repMin: undefined }))
  })

  it('strips non-digits from numeric fields', async () => {
    const { user } = await setup()
    await user.type(field('Sets'), '1a2')
    expect(field('Sets')).toHaveValue('12')
  })

  it('Close does not save', async () => {
    const { user, onSave, onOpenChange } = await setup()
    await user.type(field('Sets'), '3')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('renders the gate notice when passed', async () => {
    await setup(blank, 'Set sets and reps to activate this program.')
    expect(screen.getByText('Set sets and reps to activate this program.')).toBeInTheDocument()
  })

  it('clears the min/max error once max is corrected and then saves', async () => {
    const { user, onSave } = await setup()
    await user.type(field('Rep min'), '10')
    await user.type(field('Rep max'), '8')
    await save(user)
    expect(screen.getByText("Min can't be more than max.")).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    await user.clear(field('Rep max'))
    await user.type(field('Rep max'), '12')
    await save(user)

    expect(screen.queryByText("Min can't be more than max.")).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ repMin: 10, repMax: 12 }))
  })

  // Limits from the spec: sets 1-20, reps 1-100, RIR 0-5, rest 0:15-10:00, warm-ups 0-5.
  it.each([
    ['Sets', '1', { workingSets: 1 }],
    ['Sets', '20', { workingSets: 20 }],
    ['Rep min', '1', { repMin: 1, repMax: 1 }],
    ['Rep min', '100', { repMin: 100, repMax: 100 }],
    ['RIR', '0', { rirTarget: 0 }],
    ['RIR', '5', { rirTarget: 5 }],
    ['Warm-ups', '0', { warmupSetCount: 0 }],
    ['Warm-ups', '5', { warmupSetCount: 5 }],
    ['Rest', '15', { restSeconds: 15 }],
    ['Rest', '1000', { restSeconds: 600 }],
  ])('accepts %s = %s at the boundary', async (name, value, expected) => {
    const { user, onSave } = await setup()
    await user.type(field(name), value)
    await save(user)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining(expected))
  })

  it.each([
    ['Sets', '21', 'Enter 1 to 20.'],
    ['Rep min', '0', 'Enter 1 to 100.'],
    ['Rep min', '101', 'Enter 1 to 100.'],
    ['RIR', '6', 'Enter 0 to 5.'],
    ['Warm-ups', '6', 'Enter 0 to 5.'],
    ['Rest', '14', 'Enter 0:15 to 10:00.'],
    ['Rest', '1001', 'Enter 0:15 to 10:00.'],
  ])('rejects %s = %s with its exact message', async (name, value, message) => {
    const { user, onSave } = await setup()
    await user.type(field(name), value)
    await save(user)
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(field(name)).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('links an invalid field to its error text for screen readers', async () => {
    const { user } = await setup()
    await user.type(field('Sets'), '21')
    await save(user)
    expect(field('Sets')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Sets')).toHaveAccessibleDescription('Enter 1 to 20.')

    await user.type(field('Rep min'), '10')
    await user.type(field('Rep max'), '8')
    await save(user)
    expect(field('Rep min')).toHaveAccessibleDescription("Min can't be more than max.")
    expect(field('Rep max')).toHaveAccessibleDescription("Min can't be more than max.")
    // A valid field carries no stale description.
    expect(field('RIR')).not.toHaveAttribute('aria-invalid')
    expect(field('RIR')).not.toHaveAttribute('aria-describedby')
  })
})
