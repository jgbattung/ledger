/**
 * Single sources of record ids and timestamps for the data layer. Every
 * repo write goes through these two helpers so id generation and clock
 * reads are consistent and easy to reason about (and mock, if ever needed).
 */

export function newId(): string {
  return crypto.randomUUID()
}

export function now(): number {
  return Date.now()
}
