import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { useSessionStore } from '@/stores/sessionStore'
import { ExerciseFocus } from '@/components/session/ExerciseFocus'

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
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  )
}

/** Drags the row's sliding surface horizontally by `dx` pixels. */
function swipe(row: HTMLElement, dx: number) {
  const surface = row.querySelector<HTMLElement>('[style*="translateX"]')!
  const base = { pointerId: 1, pointerType: 'touch', clientY: 100 }
  fireEvent.pointerDown(surface, { ...base, clientX: 300 })
  fireEvent.pointerMove(surface, { ...base, clientX: 300 + dx / 2 })
  fireEvent.pointerMove(surface, { ...base, clientX: 300 + dx })
  fireEvent.pointerUp(surface, { ...base, clientX: 300 + dx })
  return surface
}

const rows = () => screen.getAllByRole('row').filter((row) => row.getAttribute('aria-label')?.startsWith('Set '))

describe('SetRow swipe-to-remove', () => {
  beforeEach(async () => {
    // Global setup unstubs between tests, so stub per test.
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    await resetDb()
    store().reset()
  })

  it('a left swipe past half-way holds the row open 52px and reveals the remove button', async () => {
    await setup()
    const surface = swipe(rows()[0], -40)
    expect(surface.style.transform).toBe('translateX(-52px)')
    expect(store().openSwipeSetId).toBe(store().exercises[0].sets[0].id)
    expect(screen.getByRole('button', { name: 'Remove set 1' })).toBeInTheDocument()
  })

  it('a short swipe snaps back', async () => {
    await setup()
    const surface = swipe(rows()[0], -15)
    expect(surface.style.transform).toBe('translateX(0px)')
    expect(store().openSwipeSetId).toBeNull()
  })

  it('swiping right closes an open row', async () => {
    await setup()
    swipe(rows()[0], -40)
    const surface = swipe(rows()[0], 40)
    expect(surface.style.transform).toBe('translateX(0px)')
    expect(store().openSwipeSetId).toBeNull()
  })

  it('only one row is open at a time', async () => {
    await setup()
    swipe(rows()[0], -40)
    swipe(rows()[1], -40)
    expect(store().openSwipeSetId).toBe(store().exercises[0].sets[1].id)
    const first = rows()[0].querySelector<HTMLElement>('[style*="translateX"]')!
    expect(first.style.transform).toBe('translateX(0px)')
  })

  it('a mostly vertical drag does not open the row', async () => {
    await setup()
    const surface = rows()[0].querySelector<HTMLElement>('[style*="translateX"]')!
    const base = { pointerId: 1, pointerType: 'touch', clientX: 300 }
    fireEvent.pointerDown(surface, { ...base, clientY: 100 })
    fireEvent.pointerMove(surface, { ...base, clientX: 280, clientY: 160 })
    fireEvent.pointerUp(surface, { ...base, clientX: 280, clientY: 160 })
    expect(store().openSwipeSetId).toBeNull()
  })

  it('tapping the minus removes the set immediately and the rows renumber', async () => {
    await setup()
    const second = store().exercises[0].sets[1].id
    swipe(rows()[1], -40)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove set 2' }))
    expect(rows()).toHaveLength(2)
    expect(store().exercises[0].sets.map((s) => s.id)).not.toContain(second)
    expect(within(rows()[1]).getByLabelText('Remove set 2')).toBeInTheDocument()
    expect(store().openSwipeSetId).toBeNull()
  })

  it('checked sets can be removed too', async () => {
    await setup()
    const first = store().exercises[0].sets[0].id
    act(() => {
      store().openPad(first, 'reps')
      store().padKey('8')
      store().closePad()
      store().toggleComplete(first)
    })
    swipe(rows()[0], -40)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove set 1' }))
    expect(rows()).toHaveLength(2)
  })

  it('the Delete key on a focused row removes it (keyboard path)', async () => {
    await setup()
    const user = userEvent.setup()
    rows()[2].focus()
    await user.keyboard('{Delete}')
    expect(rows()).toHaveLength(2)
  })

  it('the remove button is only in the tab order while the row is open', async () => {
    await setup()
    const hidden = screen.getByLabelText('Remove set 1')
    expect(hidden).toHaveAttribute('tabindex', '-1')
    swipe(rows()[0], -40)
    expect(screen.getByRole('button', { name: 'Remove set 1' })).toHaveAttribute('tabindex', '0')
  })

  it('a swipe does not also tap the cell underneath it', async () => {
    await setup()
    const reps = within(rows()[0]).getByRole('button', { name: /reps/ })
    const surface = rows()[0].querySelector<HTMLElement>('[style*="translateX"]')!
    swipe(rows()[0], -40)
    fireEvent.click(reps)
    expect(store().pad).toBeNull()
    expect(surface).toBeInTheDocument()
  })
})

describe('SetRow checked dimming (AC21)', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  const dimmed = (row: HTMLElement) => Array.from(row.querySelectorAll('.opacity-50'))

  it('a checked row dims everything but the check, and editing a cell restores full strength', async () => {
    await setup()
    const first = store().exercises[0].sets[0]
    act(() => {
      store().openPad(first.id, 'reps')
      store().padKey('8')
      store().closePad()
      store().toggleComplete(first.id)
    })
    const row = rows()[0]
    expect(dimmed(row).length).toBeGreaterThanOrEqual(3)
    const check = within(row).getByRole('checkbox', { name: 'Mark set 1 not done' })
    expect(dimmed(row).some((element) => element.contains(check))).toBe(false)

    // Tapping a checked row's cell edits it in place at full strength.
    await userEvent.click(within(row).getByRole('button', { name: 'Set 1 weight in kilograms' }))
    expect(store().pad?.setId).toBe(first.id)
    expect(dimmed(rows()[0])).toHaveLength(0)
    expect(store().exercises[0].sets[0].completedAt).toBeTypeOf('number')

    act(() => store().closePad())
    expect(dimmed(rows()[0]).length).toBeGreaterThanOrEqual(3)
  })

  it('an unchecked row is never dimmed', async () => {
    await setup()
    expect(dimmed(rows()[0])).toHaveLength(0)
  })
})
