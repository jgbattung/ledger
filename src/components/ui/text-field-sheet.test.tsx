import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextFieldSheet } from './text-field-sheet'

function Harness({
  initialValue,
  multiline,
  onSubmit,
}: {
  initialValue?: string
  multiline?: boolean
  onSubmit: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <TextFieldSheet
        open={open}
        onOpenChange={setOpen}
        title="Name your program"
        label="Program name"
        initialValue={initialValue}
        multiline={multiline}
        submitLabel="Continue"
        onSubmit={onSubmit}
      />
    </>
  )
}

describe('TextFieldSheet', () => {
  it('autofocuses the field and shows the initial value', async () => {
    const user = userEvent.setup()
    render(<Harness initialValue="New program" onSubmit={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const field = screen.getByLabelText('Program name')
    expect(field).toHaveValue('New program')
    expect(field).toHaveFocus()
  })

  it('submits the trimmed value on Enter and closes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness initialValue="" onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.type(screen.getByLabelText('Program name'), '  Push Pull Legs {Enter}')
    expect(onSubmit).toHaveBeenCalledWith('Push Pull Legs')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('disables submit when the trimmed value is empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness initialValue="" onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const submit = screen.getByRole('button', { name: 'Continue' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Program name'), '   {Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Program name'), 'A')
    expect(submit).toBeEnabled()
  })

  it('multiline allows an empty submit and Enter adds a newline', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness initialValue="" multiline onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.type(screen.getByLabelText('Program name'), 'a{Enter}b')
    expect(screen.getByLabelText('Program name')).toHaveValue('a\nb')
    expect(onSubmit).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Program name'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onSubmit).toHaveBeenCalledWith('')
  })
})
