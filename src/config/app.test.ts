import { describe, it, expect } from 'vitest'
import { APP_NAME } from './app'

// AC-6: the app name is single-sourced from this constant.
describe('APP_NAME', () => {
  it('is the single source for the app name', () => {
    expect(APP_NAME).toBe('Ledger')
  })
})
