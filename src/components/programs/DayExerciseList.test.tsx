import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { DraftDay } from '@/programs/model'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { DayExerciseList } from './DayExerciseList'

const customDay = (targets: object = {}): DraftDay => ({
  id: 'd1',
  name: 'Push',
  exercises: [{ id: 'e1', exerciseRef: { source: 'custom', exerciseId: 'mine' }, ...targets }],
})

function setup(day: DraftDay) {
  const onConfigure = vi.fn()
  const onRemove = vi.fn()
  render(
    <MemoryRouter>
      <DayExerciseList day={day} addHref="/add" onConfigure={onConfigure} onRemove={onRemove} />
    </MemoryRouter>,
  )
  return { onConfigure, onRemove }
}

describe('DayExerciseList - custom exercise rows', () => {
  it('opens the drawer for a custom row, with remove as a separate button', async () => {
    const user = userEvent.setup()
    const { onConfigure, onRemove } = setup(customDay())

    const configure = screen.getByRole('button', { name: 'Configure Custom exercise' })
    const remove = screen.getByRole('button', { name: 'Remove Custom exercise' })
    expect(configure).not.toContainElement(remove)

    await user.click(configure)
    expect(onConfigure).toHaveBeenCalledExactlyOnceWith('e1')
    expect(onRemove).not.toHaveBeenCalled()

    await user.click(remove)
    expect(onRemove).toHaveBeenCalledExactlyOnceWith('e1')
    expect(onConfigure).toHaveBeenCalledOnce()
  })

  it('shows the No targets yet marker while blank', () => {
    setup(customDay())
    expect(screen.getByText('No targets yet')).toBeInTheDocument()
  })

  it('shows the summary once sets and reps are set', () => {
    setup(customDay({ workingSets: 3, repMin: 8, repMax: 12, restSeconds: 150 }))
    expect(screen.getByText('3 × 8–12 · RIR 0 · rest 2:30')).toBeInTheDocument()
    expect(screen.queryByText('No targets yet')).not.toBeInTheDocument()
  })
})

describe('DayExerciseList - deleted custom exercise', () => {
  const row = (deletedAt?: number) =>
    ({
      id: 'mine',
      name: 'SSB Squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      deletedAt,
    }) as never

  it('shows the real name with a Deleted pill', () => {
    useCustomExerciseStore.setState({ byId: { mine: row(1) }, hydrated: true })
    setup(customDay())
    expect(screen.getByRole('button', { name: 'Configure SSB Squat' })).toHaveTextContent('Deleted')
    useCustomExerciseStore.setState({ byId: {}, hydrated: false })
  })

  it('shows no pill for a live custom exercise', () => {
    useCustomExerciseStore.setState({ byId: { mine: row() }, hydrated: true })
    setup(customDay())
    expect(screen.queryByText('Deleted')).toBeNull()
    useCustomExerciseStore.setState({ byId: {}, hydrated: false })
  })
})
