import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DraftDay } from '@/programs/model'
import { DayTabs } from './DayTabs'

const days: DraftDay[] = ['A', 'B', 'C'].map((name) => ({ id: `id-${name}`, name, exercises: [] }))

function Harness() {
  const [selected, setSelected] = useState('id-A')
  return <DayTabs days={days} selectedId={selected} onSelect={setSelected} onAdd={() => {}} />
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('DayTabs keyboard navigation', () => {
  it('only the selected tab is in the tab order', () => {
    render(<Harness />)
    expect(tab('A')).toHaveAttribute('tabindex', '0')
    expect(tab('B')).toHaveAttribute('tabindex', '-1')
    expect(tab('C')).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowRight and ArrowLeft move, select and focus, wrapping at the ends', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    tab('A').focus()
    await user.keyboard('{ArrowLeft}')
    expect(tab('C')).toHaveAttribute('aria-selected', 'true')
    expect(tab('C')).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(tab('A')).toHaveAttribute('aria-selected', 'true')
    expect(tab('A')).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(tab('B')).toHaveAttribute('aria-selected', 'true')
    expect(tab('B')).toHaveFocus()
    expect(tab('B')).toHaveAttribute('tabindex', '0')
    expect(tab('A')).toHaveAttribute('tabindex', '-1')
  })

  it('Home and End jump to the first and last tab', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    tab('A').focus()
    await user.keyboard('{End}')
    expect(tab('C')).toHaveFocus()
    expect(tab('C')).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(tab('A')).toHaveFocus()
    expect(tab('A')).toHaveAttribute('aria-selected', 'true')
  })

  it('+ Day is outside the tablist and still keyboard reachable', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const add = screen.getByRole('button', { name: 'Day' })
    expect(within(screen.getByRole('tablist')).queryByRole('button', { name: 'Day' })).toBeNull()
    expect(add).not.toHaveAttribute('tabindex', '-1')
    tab('A').focus()
    await user.tab()
    expect(add).toHaveFocus()
  })
})
