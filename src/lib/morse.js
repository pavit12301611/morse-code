/* Morse code data + CW timing maths.

   The app is deliberately small: a random listening test and a full
   reference sheet. The audio engine still schedules real, correctly
   timed tones, so what you hear is the actual rhythm of the character.
*/

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.',
  '$': '...-..-', '@': '.--.-.',
}

export const PROSIGNS = [
  { label: 'AR', code: '.-.-.', meaning: 'End of message' },
  { label: 'SK', code: '...-.-', meaning: 'End of contact' },
  { label: 'BT', code: '-...-', meaning: 'Break / new paragraph' },
  { label: 'KN', code: '-.--.', meaning: 'Go, only the named station' },
  { label: 'HH', code: '........', meaning: 'Error, disregard' },
  { label: 'SOS', code: '...---...', meaning: 'Distress call' },
]

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const DIGITS = '0123456789'.split('')
export const PUNCT = ['.', ',', '?', "'", '!', '/', '(', ')', '&', ':', ';', '=', '+', '-', '_', '"', '$', '@']

const PUNCT_NAMES = {
  '.': 'period',
  ',': 'comma',
  '?': 'question mark',
  "'": 'apostrophe',
  '!': 'exclamation',
  '/': 'slash',
  '(': 'open paren',
  ')': 'close paren',
  '&': 'ampersand',
  ':': 'colon',
  ';': 'semicolon',
  '=': 'equals',
  '+': 'plus',
  '-': 'hyphen',
  '_': 'underscore',
  '"': 'quote',
  '$': 'dollar',
  '@': 'at sign',
}

/** A human name for punctuation; letters and digits are their own name. */
export function charName(char) {
  return PUNCT_NAMES[char] || char
}

export function patternOf(char) {
  return MORSE[String(char).toUpperCase()] || ''
}

/* ---------------------------- timing ---------------------------- */

// One "dit" at a given character speed, in milliseconds (PARIS standard).
export const unitMs = (charWpm) => 1200 / charWpm

/**
 * Farnsworth spacing: characters are sent at `charWpm`, while the extra
 * silence needed to reach `effWpm` is split between letter and word gaps.
 */
export function gapUnits(charWpm, effWpm) {
  const ratio = charWpm / Math.max(1, Math.min(effWpm, charWpm))
  const extra = ratio - 1
  return {
    char: Math.min(30, 3 + 9 * extra),
    word: Math.min(42, 7 + 14 * extra),
  }
}

/**
 * Turn a Morse string ("...- .-.. / ---") into an absolutely timed
 * sequence of tone events.
 */
export function buildTimeline(code, { charWpm = 20, effWpm = 12 } = {}) {
  const unit = unitMs(charWpm) / 1000
  const gaps = gapUnits(charWpm, effWpm)
  const events = []
  const chars = []
  let t = 0

  const words = String(code).trim().split(/\s*\/\s*/).filter((w) => w.trim())
  words.forEach((word, wi) => {
    const letters = word.trim().split(/\s+/).filter(Boolean)
    letters.forEach((letter, li) => {
      const charStart = t
      let elementIndex = 0
      for (const sym of letter) {
        const durUnits = sym === '-' ? 3 : 1
        events.push({
          start: t,
          dur: durUnits * unit,
          charIndex: chars.length,
          elementIndex,
          sym,
        })
        t += durUnits * unit
        if (elementIndex < letter.length - 1) t += unit
        elementIndex += 1
      }
      chars.push({ letter, start: charStart, end: t, index: chars.length })
      const isLastLetter = li === letters.length - 1
      const isLastWord = wi === words.length - 1
      if (!(isLastLetter && isLastWord)) {
        t += (isLastLetter ? gaps.word : gaps.char) * unit
      }
    })
  })

  const total = events.length
    ? events[events.length - 1].start + events[events.length - 1].dur
    : 0

  return {
    events,
    chars,
    total,
    unit,
    gaps,
    // A little tail so the last tone can decay before we say "done".
    totalWithTail: total + 0.12,
  }
}

/* --------------------------- helpers --------------------------- */

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
