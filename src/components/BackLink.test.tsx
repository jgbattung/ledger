import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BackLink } from './BackLink'

describe('BackLink', () => {
  it('renders a link to the given path', () => {
    render(
      <MemoryRouter>
        <BackLink to="/more" label="Back to More" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Back to More' })).toHaveAttribute('href', '/more')
  })

  it('renders a button that calls onBack', async () => {
    const onBack = vi.fn()
    render(
      <MemoryRouter>
        <BackLink onBack={onBack} label="Back" />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
