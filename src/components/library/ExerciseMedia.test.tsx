import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseMedia } from './ExerciseMedia'

describe('ExerciseMedia', () => {
  it('renders one image per path with Start and End alt text for two', () => {
    render(<ExerciseMedia images={['A/0.jpg', 'A/1.jpg']} />)
    expect(screen.getByAltText('Start position')).toHaveAttribute('src', expect.stringContaining('A/0.jpg'))
    expect(screen.getByAltText('End position')).toHaveAttribute('src', expect.stringContaining('A/1.jpg'))
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('loads the first image eagerly and the rest lazily', () => {
    render(<ExerciseMedia images={['A/0.jpg', 'A/1.jpg']} />)
    expect(screen.getByAltText('Start position')).toHaveAttribute('loading', 'eager')
    expect(screen.getByAltText('End position')).toHaveAttribute('loading', 'lazy')
  })

  it('numbers the alt text for any other count', () => {
    render(<ExerciseMedia images={['A/0.jpg']} />)
    expect(screen.getByAltText('Demo photo 1 of 1')).toBeInTheDocument()
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<ExerciseMedia images={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows dots for two images and none for one', () => {
    const two = render(<ExerciseMedia images={['A/0.jpg', 'A/1.jpg']} />)
    expect(two.container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(2)
    two.unmount()
    const one = render(<ExerciseMedia images={['A/0.jpg']} />)
    expect(one.container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0)
  })
})
