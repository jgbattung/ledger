import type { Unit } from '@/db/types'

/** 1 lb in kg, exact (international pound). */
export const KG_PER_LB = 0.45359237

const kgFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })
const lbFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, useGrouping: false })

/** Stored kg to the display unit, full precision. */
export function toDisplay(kg: number, unit: Unit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg
}

/** A value typed in the display unit to stored kg, full precision, never rounded. */
export function fromDisplay(value: number, unit: Unit): number {
  return unit === 'lb' ? value * KG_PER_LB : value
}

/** Rounded display string (lb: 1 decimal, kg: 2 decimals, trailing zeros dropped). */
export function formatWeight(kg: number, unit: Unit): string {
  const value = toDisplay(kg, unit)
  return (unit === 'lb' ? lbFormat : kgFormat).format(value)
}

export function unitLabel(unit: Unit): 'kg' | 'lb' {
  return unit
}

export function unitName(unit: Unit): 'kilograms' | 'pounds' {
  return unit === 'lb' ? 'pounds' : 'kilograms'
}
