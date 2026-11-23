/* ------------------------------------------------------------------
   Morse code data + timing maths.

   The whole app is built on one idea: Morse is a sound language, not a
   picture of dots and dashes. Every drill schedules real, correctly
   timed tones at a fast "character speed", while the Farnsworth gap
   between characters is stretched to make copying comfortable.
------------------------------------------------------------------- */

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

export const KOCH_ORDER = [
  'K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O', 'W', 'I', '.',
  'N', 'J', 'E', 'F', '0', 'Y', 'V', ',', 'G', '5', '/', 'Q', '9',
  'Z', 'H', '3', '8', 'B', '?', '4', '2', '7', 'C', '1', '6', 'D', 'X',
]

export const LETTERS = Object.keys(MORSE).filter((c) => /[A-Z]/.test(c))
export const DIGITS = '0123456789'.split('')
export const PUNCT = ['.', ',', '?', "'", '!', '/', '(', ')', '&', ':', ';', '=', '+', '-', '_', '"', '$', '@']

export const CODE_TO_CHAR = Object.fromEntries(
  Object.entries(MORSE).map(([char, code]) => [code, char]),
)

export const ALL_CHARS = Object.keys(MORSE)

export function patternOf(char) {
  return MORSE[String(char).toUpperCase()] || ''
}

export function encode(text) {
  return String(text)
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word].map((c) => MORSE[c] || '').filter(Boolean).join(' '),
    )
    .join(' / ')
}

export function decode(morseText) {
  return String(morseText)
    .trim()
    .split(/\s*\/\s*|\s{3,}/)
    .filter(Boolean)
    .map((word) =>
      word
        .split(/\s+/)
        .map((code) => CODE_TO_CHAR[code] || '?')
        .join(''),
    )
    .join(' ')
}

/* ---------------------------- timing ---------------------------- */

// One "dit" at a given character speed, in milliseconds (PARIS standard).
export const unitMs = (charWpm) => 1200 / charWpm

/**
 * Farnsworth spacing.
 *
 * At the PARIS standard, a proper word is 50 dot-units. If characters
 * are sent at `charWpm` but we want an *effective* speed of `effWpm`,
 * we must add 50 * (charWpm/effWpm - 1) units of extra silence per word.
 * We split that extra silence between the four character gaps (9 extra
 * units each) and the word gap (14 extra units), so words get a little
 * extra breathing room without breaking the stated WPM.
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
 *
 * Returns seconds-based timings plus per-character spans so the UI can
 * highlight exactly what is being played.
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

/* --------------------------- generator --------------------------- */

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomChar(chars) {
  return randomFrom(chars)
}

export function randomGroup(chars, length = 5) {
  return Array.from({ length }, () => randomChar(chars)).join('')
}

export function randomWord(chars, words) {
  const usable = words.filter((w) => [...w].every((c) => chars.includes(c)))
  if (!usable.length) return randomGroup(chars, 3)
  return randomFrom(usable)
}

export const COMMON_WORDS = [
  'THE', 'AND', 'THAT', 'HAVE', 'WITH', 'THIS', 'FROM', 'THEY', 'WILL',
  'THERE', 'WHAT', 'ABOUT', 'WHICH', 'WHEN', 'MAKE', 'LIKE', 'TIME',
  'JUST', 'KNOW', 'TAKE', 'INTO', 'YEAR', 'GOOD', 'SOME', 'COULD',
  'THEM', 'SEE', 'OTHER', 'THAN', 'THEN', 'NOW', 'LOOK', 'ONLY', 'COME',
  'OVER', 'THINK', 'ALSO', 'BACK', 'AFTER', 'WORK', 'FIRST', 'WELL',
  'WAY', 'EVEN', 'NEW', 'WANT', 'ANY', 'THESE', 'GIVE', 'DAY', 'MOST',
  'US', 'WATER', 'RADIO', 'SIGNAL', 'MORSE', 'NIGHT', 'LIGHT', 'STORM',
]

export const CALLSIGNS = [
  'W1AW', 'K2MOR', 'N0CALL', 'VE3XYZ', 'G4ABC', 'JA1XYZ', 'VK2IO',
  'DL1ABC', 'F5XYZ', 'I2MOR', 'K6KEY', 'W7DIT', 'N3DAH', 'AA1ABC',
  'KH6XYZ', 'PY2ABC', 'OH2XYZ', 'ZS6ABC', 'W0RSE', 'K9MOR',
]

export const QSO_LINES = [
  'CQ CQ CQ DE W1AW K',
  'UR RST 599 599',
  'QTH IS BOSTON',
  'NAME IS SAM',
  'TNX FER CALL',
  'QSL VIA BURO',
  '73 ES GL SK',
  'RIG IS ICOM 7300',
  'ANT IS DIPOLE',
  'WX IS CLEAR',
]

export const PLAIN_TEXT = [
  'THE BEST WAY TO LEARN MORSE IS BY EAR',
  'COPY THE SOUND NOT THE DOTS AND DASHES',
  'SEND SLOWLY AND YOU WILL RECEIVE SLOWLY',
  'PRACTICE A LITTLE EVERY DAY',
  'RHYTHM IS THE WHOLE SECRET OF THE CODE',
]

/* ------------------------- per-character ------------------------- */

// Characters introduced in "lessons" of two (the Koch method).
export function buildLessons(perLesson = 2) {
  const lessons = []
  for (let i = 0; i < KOCH_ORDER.length; i += perLesson) {
    lessons.push({
      id: i / perLesson + 1,
      chars: KOCH_ORDER.slice(i, i + perLesson),
      previous: KOCH_ORDER.slice(0, i),
    })
  }
  return lessons
}

export const charLabel = (c) => (c === '.' ? 'period' : c === ',' ? 'comma' : c === '/' ? 'slash' : c === '?' ? 'question mark' : c)

export function rhythm(code) {
  return [...code].map((s) => (s === '-' ? 'dah' : 'dit')).join(' · ')
}

export function spokenName(c) {
  const map = {
    '.': 'period', ',': 'comma', '/': 'slash', '?': 'question mark',
    0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
    6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  }
  return map[c] || c
}
