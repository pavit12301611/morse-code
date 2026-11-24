import { shuffle } from './morse'

/** How many characters a full test asks about (or fewer, if the pool is smaller). */
export const TEST_SIZE = 20

/**
 * Build a fresh, randomly ordered test deck.
 *
 * Every call reshuffles the whole pool, so two tests never share the same
 * order and (unless the pool is tiny) don't even share the same characters.
 * Duplicates in the pool are collapsed; every character appears at most once
 * per test.
 */
export function buildDeck(pool, size = TEST_SIZE) {
  const unique = [...new Set(pool)]
  return shuffle(unique).slice(0, Math.min(size, unique.length))
}

export function normalizeAnswer(value) {
  return String(value ?? '').trim().toUpperCase()
}

/** Case- and whitespace-insensitive comparison of a typed answer to a character. */
export function isCorrect(input, expected) {
  return normalizeAnswer(input) === String(expected).toUpperCase()
}
