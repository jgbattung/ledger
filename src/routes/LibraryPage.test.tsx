import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getAllExercises } from '@/exercises/catalog'
import { LibraryPage } from './LibraryPage'

/**
 * LG-005 Library screen: search + filter chips + sheet driving a single
 * filtered results array, count line, empty state, and reset. Counts are
 * asserted against the live dataset, never hardcoded (LIB-2/LIB-3).
 */

function renderLibrary() {
  return render(<LibraryPage />)
}

describe('LibraryPage', () => {
  it('renders the full count and the first row on initial render', () => {
    renderLibrary()

    const all = getAllExercises()
    expect(screen.getByText(`${all.length} exercises`)).toBeInTheDocument()
    expect(screen.getByText(all[0].name)).toBeInTheDocument()
  })

  it('filters visible rows and updates the count when typing (LIB-2)', async () => {
    const user = userEvent.setup()
    renderLibrary()

    const all = getAllExercises()
    const expected = all.filter((e) => e.name.toLowerCase().includes('curl'))

    await user.type(screen.getByLabelText('Search exercises'), 'curl')

    expect(await screen.findByText(`${expected.length} exercises`)).toBeInTheDocument()
    expect(screen.getByText('Barbell Curl')).toBeInTheDocument()
    expect(screen.queryByText(all.find((e) => !e.name.toLowerCase().includes('curl'))!.name)).not.toBeInTheDocument()
  })

  it('narrows results via the Muscle sheet, then further via Equipment (AND, LIB-3)', async () => {
    const user = userEvent.setup()
    renderLibrary()

    const all = getAllExercises()

    await user.click(screen.getByRole('button', { name: 'Muscle' }))
    await user.click(await screen.findByRole('button', { name: 'Chest' }))

    const chestExpected = all.filter((e) => e.primaryMuscles.includes('chest'))
    expect(await screen.findByText(`${chestExpected.length} exercises`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Equipment' }))
    await user.click(await screen.findByRole('button', { name: 'Barbell' }))

    const chestBarbellExpected = all.filter(
      (e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell',
    )
    expect(await screen.findByText(`${chestBarbellExpected.length} exercises`)).toBeInTheDocument()
    expect(chestBarbellExpected.length).toBeGreaterThan(0)
    expect(screen.getByText(chestBarbellExpected[0].name)).toBeInTheDocument()
  })

  it('filters via the Category sheet (category facet path)', async () => {
    const user = userEvent.setup()
    renderLibrary()

    const all = getAllExercises()

    await user.click(screen.getByRole('button', { name: 'Category' }))
    // Values are Title-cased for display; 'strength' -> 'Strength'.
    await user.click(await screen.findByRole('button', { name: 'Strength' }))

    const strengthExpected = all.filter((e) => e.category === 'strength')
    expect(await screen.findByText(`${strengthExpected.length} exercises`)).toBeInTheDocument()
    expect(strengthExpected.length).toBeGreaterThan(0)
    // The chip now reflects the selected value.
    expect(screen.getByRole('button', { name: 'Strength' })).toBeInTheDocument()
  })

  it('clears a facet from inside the sheet via the "All" row', async () => {
    const user = userEvent.setup()
    renderLibrary()

    const all = getAllExercises()

    await user.click(screen.getByRole('button', { name: 'Muscle' }))
    await user.click(await screen.findByRole('button', { name: 'Chest' }))

    const chestExpected = all.filter((e) => e.primaryMuscles.includes('chest'))
    expect(await screen.findByText(`${chestExpected.length} exercises`)).toBeInTheDocument()

    // Reopen the (now active) facet and pick "All" to clear it from the sheet.
    await user.click(screen.getByRole('button', { name: 'Chest' }))
    await user.click(await screen.findByRole('button', { name: 'All' }))

    expect(await screen.findByText(`${all.length} exercises`)).toBeInTheDocument()
  })

  it("clears the query via the search field's own clear button", async () => {
    const user = userEvent.setup()
    renderLibrary()

    const all = getAllExercises()
    const search = screen.getByLabelText('Search exercises')

    await user.type(search, 'curl')
    const curlExpected = all.filter((e) => e.name.toLowerCase().includes('curl'))
    expect(await screen.findByText(`${curlExpected.length} exercises`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(await screen.findByText(`${all.length} exercises`)).toBeInTheDocument()
    expect(search).toHaveValue('')
  })

  it('clearing a chip restores the broader result set', async () => {
    const user = userEvent.setup()
    renderLibrary()

    const all = getAllExercises()

    await user.click(screen.getByRole('button', { name: 'Muscle' }))
    await user.click(await screen.findByRole('button', { name: 'Chest' }))

    const chestExpected = all.filter((e) => e.primaryMuscles.includes('chest'))
    expect(await screen.findByText(`${chestExpected.length} exercises`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear Muscle filter' }))

    expect(await screen.findByText(`${all.length} exercises`)).toBeInTheDocument()
  })

  it('shows the empty state for a nonsense query and the reset button clears query and filters', async () => {
    const user = userEvent.setup()
    renderLibrary()

    const all = getAllExercises()

    await user.click(screen.getByRole('button', { name: 'Muscle' }))
    await user.click(await screen.findByRole('button', { name: 'Chest' }))
    await user.type(screen.getByLabelText('Search exercises'), 'zzzzznonsensequery')

    expect(await screen.findByText('No exercises match')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search & filters' }))

    expect(await screen.findByText(`${all.length} exercises`)).toBeInTheDocument()
    expect(screen.getByLabelText('Search exercises')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Muscle' })).toBeInTheDocument()
  })
})
