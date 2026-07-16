import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from './sheet'

describe('Sheet', () => {
  it('opens via the trigger and shows a dialog with the title as its accessible name', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Muscle</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByText('Open'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Muscle')
  })

  it('closes via the close button', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Muscle</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )

    await user.click(screen.getByText('Open'))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
