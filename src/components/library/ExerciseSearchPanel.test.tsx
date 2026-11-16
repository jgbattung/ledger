import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ExerciseSearchPanel } from '@/components/library/ExerciseSearchPanel'

function Where() {
  const { search } = useLocation()
  return <p data-testid="search">{search}</p>
}

function renderPanel(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ExerciseSearchPanel header={<h1>Pick</h1>} renderRow={(ex) => <span>{ex.name}</span>} />
      <Where />
    </MemoryRouter>,
  )
}

describe('ExerciseSearchPanel URL state', () => {
  it('seeds the query and a filter from the URL', () => {
    renderPanel('/picker?q=curl&equipment=barbell')
    expect(screen.getByLabelText('Search exercises')).toHaveValue('curl')
    expect(screen.getByRole('button', { name: /barbell/i })).toBeInTheDocument()
    expect(screen.getByText('Barbell Curl')).toBeInTheDocument()
  })

  it('ignores an unknown filter value', () => {
    renderPanel('/picker?muscle=not-a-muscle')
    expect(screen.getByRole('button', { name: 'Muscle' })).toBeInTheDocument()
  })

  it('writes the query and a filter back and keeps unrelated params', async () => {
    const user = userEvent.setup()
    renderPanel('/picker?day=abc')
    await user.type(screen.getByLabelText('Search exercises'), 'curl')
    await user.click(screen.getByRole('button', { name: 'Muscle' }))
    await user.click(await screen.findByRole('button', { name: 'Biceps' }))
    const params = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(params.get('day')).toBe('abc')
    expect(params.get('q')).toBe('curl')
    expect(params.get('muscle')).toBe('biceps')
  })
})
