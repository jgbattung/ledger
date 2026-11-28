import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { SettingsProvider } from '@/settings/SettingsProvider'
import { useSessionStore } from '@/stores/sessionStore'
import { ExerciseFocus } from '@/components/session/ExerciseFocus'
import type { Set as SetRecord } from '@/db/types'

const store = () => useSessionStore.getState()

// jsdom has no PointerEvent, so synthetic pointer events would lose their coordinates.
class TestPointerEvent extends MouseEvent {
  pointerId: number
  pointerType: string
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
    this.pointerType = init.pointerType ?? 'mouse'
  }
}

function Harness() {
  const entry = useSessionStore((state) => state.exercises[0])
  return entry ? <ExerciseFocus entry={entry} /> : null
}

async function setup() {
  const programId = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
  const tree = (await programs.loadTree(programId))!
  await store().start(programId, tree.days[0].day.id)
  render(
    <SettingsProvider>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </SettingsProvider>,
  )
}

const rows = () =>
  screen.getAllByRole('row').filter((row) => row.getAttribute('aria-label')?.startsWith('Set '))
const chip = () => screen.getByRole('button', { name: 'L/R' })

/** Types `keys` on the given side/field of the first set and leaves the pad closed. */
function type(setId: string, field: 'weight' | 'reps', side: 'L' | 'R', ...keys: string[]) {
  act(() => {
    store().openPad(setId, field, side)
    for (const key of keys) store().padKey(key as never)
    store().closePad()
  })
}

describe('L/R chip (LG-012, M1 and M4)', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  it('is last in the chip row and unpressed until turned on', async () => {
    await setup()
    const names = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => ['Swap', 'Targets', 'Warm Up', 'Info', 'L/R'].includes(text ?? ''))
    expect(names.at(-1)).toBe('L/R')
    expect(chip()).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(chip())
    expect(chip()).toHaveAttribute('aria-pressed', 'true')
    expect(store().exercises[0].sets.every((set) => set.unilateral != null)).toBe(true)
  })

  it('is disabled with zero sets', async () => {
    await setup()
    for (const set of store().exercises[0].sets) act(() => store().removeSet(set.id))
    expect(chip()).toBeDisabled()
  })

  it('turns off immediately when every set has equal sides', async () => {
    await setup()
    await userEvent.click(chip())
    await userEvent.click(chip())
    expect(chip()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('Log both sides together?')).toBeNull()
    expect(store().exercises[0].sets.every((set) => set.unilateral == null)).toBe(true)
  })

  it('asks before merging differing sides, and Keep L/R leaves the data untouched', async () => {
    await setup()
    await userEvent.click(chip())
    const first = store().exercises[0].sets[0].id
    type(first, 'weight', 'R', '2', '2')
    type(first, 'reps', 'L', '1', '2')
    type(first, 'reps', 'R', '1', '0')

    await userEvent.click(chip())
    expect(screen.getByText('Log both sides together?')).toBeInTheDocument()
    expect(screen.getByText(/set 1 becomes 22 kg × 10/)).toBeInTheDocument()
    const before = store().exercises[0].sets[0].unilateral

    await userEvent.click(screen.getByRole('button', { name: 'Keep L/R' }))
    expect(store().exercises[0].sets[0].unilateral).toEqual(before)
    expect(chip()).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(chip())
    await userEvent.click(screen.getByRole('button', { name: 'Log both sides together' }))
    expect(store().exercises[0].sets[0]).toMatchObject({ weight: 22, reps: 10 })
    expect(store().exercises[0].sets[0].unilateral).toBeUndefined()
  })
})

describe('L/R set row (LG-012, M2)', () => {
  beforeEach(async () => {
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    await resetDb()
    store().reset()
  })

  it('renders two lines with side-specific cells and one set number and check', async () => {
    await setup()
    await userEvent.click(chip())
    const row = rows()[0]
    for (const label of [
      'Set 1 left weight in kilograms',
      'Set 1 left reps',
      'Set 1 right weight in kilograms',
      'Set 1 right reps',
    ]) {
      expect(within(row).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(within(row).getAllByRole('checkbox')).toHaveLength(1)
    expect(within(row).getByText('L')).toBeInTheDocument()
    expect(within(row).getByText('R')).toBeInTheDocument()
  })

  it('opens the pad on the tapped side', async () => {
    await setup()
    await userEvent.click(chip())
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 right reps' }))
    expect(store().pad?.entry).toMatchObject({ field: 'reps', side: 'R' })
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 left weight in kilograms' }))
    expect(store().pad?.entry).toMatchObject({ field: 'weight', side: 'L' })
  })

  it('shows the RIR badge on the left reps cell only', async () => {
    await setup()
    await userEvent.click(chip())
    const first = store().exercises[0].sets[0].id
    type(first, 'reps', 'L', '1', '2')
    const row = rows()[0]
    expect(within(row).getByRole('button', { name: /^Set 1 left reps, RIR/ })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Set 1 right reps' })).toBeInTheDocument()
  })

  it('a checked row dims both lines and swipe removes the whole set', async () => {
    await setup()
    await userEvent.click(chip())
    const first = store().exercises[0].sets[0].id
    type(first, 'reps', 'L', '1', '2')
    type(first, 'reps', 'R', '1', '0')
    act(() => store().toggleComplete(first))
    const row = rows()[0]
    expect(row.querySelectorAll('.opacity-50').length).toBeGreaterThanOrEqual(5)

    const surface = row.querySelector<HTMLElement>('[style*="translateX"]')!
    const base = { pointerId: 1, pointerType: 'touch', clientY: 100 }
    fireEvent.pointerDown(surface, { ...base, clientX: 300 })
    fireEvent.pointerMove(surface, { ...base, clientX: 280 })
    fireEvent.pointerMove(surface, { ...base, clientX: 260 })
    fireEvent.pointerUp(surface, { ...base, clientX: 260 })
    await userEvent.click(screen.getByRole('button', { name: 'Remove set 1' }))
    expect(rows()).toHaveLength(2)
  })

  it('shows a per-side partial in its own reps cell', async () => {
    await setup()
    await userEvent.click(chip())
    const first = store().exercises[0].sets[0].id
    type(first, 'reps', 'R', '8', 'fp', '2')
    const cell = screen.getByRole('button', { name: 'Set 1 right reps' })
    expect(cell).toHaveTextContent('8|2')
    expect(screen.getByRole('button', { name: /Set 1 left reps/ })).not.toHaveTextContent('|')
  })
})

describe('L/R merge confirm and Previous edge cases (LG-012)', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  /** Last session's sets for the focused exercise, as the store would load them. */
  function setPrevious(previous: Partial<SetRecord>[]) {
    const id = store().exercises[0].exercise.id
    act(() =>
      useSessionStore.setState((state) => ({
        previousByExercise: { ...state.previousByExercise, [id]: previous as SetRecord[] },
      })),
    )
  }

  it('names the first set whose sides differ, not set 1', async () => {
    await setup()
    await userEvent.click(chip())
    const second = store().exercises[0].sets[1].id
    type(second, 'weight', 'L', '2', '4')
    type(second, 'reps', 'L', '6')
    type(second, 'weight', 'R', '2', '4')
    type(second, 'reps', 'R', '8')

    await userEvent.click(chip())
    expect(screen.getByText(/set 2 becomes 24 kg × 6/)).toBeInTheDocument()
  })

  it('shows the merged partial in the confirm copy', async () => {
    await setup()
    await userEvent.click(chip())
    const first = store().exercises[0].sets[0].id
    type(first, 'weight', 'L', '2', '0')
    type(first, 'reps', 'L', '8', 'fp', '2')
    type(first, 'weight', 'R', '2', '0')
    type(first, 'reps', 'R', '6')

    await userEvent.click(chip())
    expect(screen.getByText(/set 1 becomes 20 kg × 8 | 2./)).toBeInTheDocument()
  })

  it('asks before merging when only the partials differ', async () => {
    await setup()
    await userEvent.click(chip())
    const first = store().exercises[0].sets[0].id
    type(first, 'reps', 'L', '8', 'fp', '2')
    type(first, 'reps', 'R', '8')

    await userEvent.click(chip())
    expect(screen.getByText('Log both sides together?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Log both sides together' }))
    // Full tie: L wins and keeps its partial on the merged set.
    expect(store().exercises[0].sets[0]).toMatchObject({ reps: 8, partialReps: 2 })
    expect(chip()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('Log both sides together?')).toBeNull()
  })

  it('shows a normal previous set on both lines of an L/R row, without RIR', async () => {
    await setup()
    setPrevious([{ weight: 20, reps: 12, rir: 1, rirIsPlus: false }])
    await userEvent.click(chip())
    const row = rows()[0]
    expect(within(row).getAllByText('20 kg × 12')).toHaveLength(2)
    expect(within(row).queryByText('RIR 1')).toBeNull()
  })

  it('shows an L/R previous set per side, with its partial, on an L/R row', async () => {
    await setup()
    setPrevious([
      {
        weight: 22,
        reps: 10,
        rir: 1,
        rirIsPlus: false,
        unilateral: {
          leftWeight: 20,
          leftReps: 12,
          rightWeight: 22,
          rightReps: 10,
          rightPartialReps: 2,
        },
      },
    ])
    await userEvent.click(chip())
    const row = rows()[0]
    expect(within(row).getByText('20 kg × 12')).toBeInTheDocument()
    expect(within(row).getByText(/22 kg × 10/)).toHaveTextContent('22 kg × 10|2')
  })

  it('shows an L/R previous set as its aggregate on a normal row', async () => {
    await setup()
    setPrevious([
      {
        weight: 22,
        reps: 10,
        rir: 1,
        rirIsPlus: false,
        unilateral: { leftWeight: 20, leftReps: 12, rightWeight: 22, rightReps: 10 },
      },
    ])
    const row = rows()[0]
    expect(within(row).getByText('22 kg × 10')).toBeInTheDocument()
    expect(within(row).getByText('RIR 1')).toBeInTheDocument()
  })
})
