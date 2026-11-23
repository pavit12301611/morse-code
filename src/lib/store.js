import { useEffect, useSyncExternalStore } from 'react'
import { KOCH_ORDER } from './morse'

const KEY = 'morse-studio:v1'

const defaultState = {
  version: 1,
  settings: {
    charWpm: 20,
    effWpm: 12,
    freq: 620,
    volume: 0.45,
    wave: 'sine',
    theme: 'dark',
    keyer: 'paddle',
    autoPlay: true,
    showPatterns: false,
  },
  progress: {
    lesson: 1,
    completed: {},
    chars: {},
    sessions: [],
    streak: { count: 0, last: null },
    totalPracticeMs: 0,
    onboarded: false,
    goalMinutes: 10,
  },
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return structuredClone(base)
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings || {}) },
    progress: { ...base.progress, ...(saved.progress || {}) },
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(defaultState)
    return merge(defaultState, JSON.parse(raw))
  } catch {
    return structuredClone(defaultState)
  }
}

let state = load()
const listeners = new Set()
let writeTimer = null

function persist() {
  clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage full / private mode — keep running in memory */
    }
  }, 120)
}

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function emit() {
  listeners.forEach((fn) => fn())
  persist()
}

export const store = {
  get: () => state,
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  update(fn) {
    const next = typeof fn === 'function' ? fn(state) : fn
    if (!next) return
    state = next
    emit()
  },
  setSettings(patch) {
    store.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  },
  setProgress(patch) {
    store.update((s) => ({
      ...s,
      progress: { ...s.progress, ...(typeof patch === 'function' ? patch(s.progress) : patch) },
    }))
  },
  recordChar(char, ok, ms) {
    store.update((s) => {
      const prev = s.progress.chars[char] || { shown: 0, ok: 0, ms: 0, last: 0 }
      return {
        ...s,
        progress: {
          ...s.progress,
          chars: {
            ...s.progress.chars,
            [char]: {
              shown: prev.shown + 1,
              ok: prev.ok + (ok ? 1 : 0),
              ms: prev.ms + Math.min(20000, ms || 0),
              last: Date.now(),
            },
          },
        },
      }
    })
  },
  recordSession({ kind, label, items, correct, wpm = 0, durationMs = 0 }) {
    const now = new Date()
    const day = localDay(now)
    store.update((s) => {
      const streak = { ...s.progress.streak }
      if (streak.last !== day) {
        const yesterday = localDay(new Date(Date.now() - 864e5))
        streak.count = streak.last === yesterday ? streak.count + 1 : 1
        streak.last = day
      }
      const session = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: now.toISOString(),
        kind,
        label,
        items,
        correct,
        accuracy: items ? correct / items : 0,
        wpm,
        durationMs,
      }
      return {
        ...s,
        progress: {
          ...s.progress,
          streak,
          sessions: [...s.progress.sessions, session].slice(-120),
          totalPracticeMs: s.progress.totalPracticeMs + durationMs,
        },
      }
    })
  },
  completeLesson(id, { accuracy = 0, items = 0 } = {}) {
    store.update((s) => ({
      ...s,
      progress: {
        ...s.progress,
        completed: {
          ...s.progress.completed,
          [id]: {
            accuracy,
            items,
            date: new Date().toISOString(),
            best: Math.max(accuracy, s.progress.completed[id]?.best || 0),
          },
        },
        lesson: Math.max(s.progress.lesson, Math.min(20, id + 1)),
      },
    }))
  },
  setLesson(n) {
    store.update((s) => ({
      ...s,
      progress: { ...s.progress, lesson: Math.max(1, Math.min(20, n)) },
    }))
  },
  reset() {
    state = structuredClone(defaultState)
    emit()
  },
  exportJSON() {
    return JSON.stringify(state, null, 2)
  },
  importJSON(text) {
    try {
      state = merge(defaultState, JSON.parse(text))
      emit()
      return true
    } catch {
      return false
    }
  },
}

/* --------------------------- selectors --------------------------- */

export function knownChars(progress) {
  return KOCH_ORDER.slice(0, Math.max(2, progress.lesson * 2))
}

export function charAccuracy(entry) {
  if (!entry || !entry.shown) return null
  return entry.ok / entry.shown
}

export function weakestChars(progress, known, limit = 6) {
  return known
    .map((c) => {
      const entry = progress.chars[c]
      return {
        char: c,
        shown: entry?.shown || 0,
        acc: charAccuracy(entry),
        avgMs: entry?.shown ? entry.ms / entry.shown : null,
      }
    })
    .filter((x) => x.shown > 0)
    .sort((a, b) => {
      const aa = a.acc ?? 1
      const bb = b.acc ?? 1
      if (aa !== bb) return aa - bb
      return (b.avgMs || 0) - (a.avgMs || 0)
    })
    .slice(0, limit)
}

export function bestCopySpeed(progress) {
  const speeds = progress.sessions
    .filter((s) => s.wpm > 0 && s.kind !== 'send')
    .map((s) => s.wpm)
  return speeds.length ? Math.round(Math.max(...speeds)) : 0
}

export function accuracyAverage(progress, limit = 10) {
  const recent = progress.sessions.slice(-limit)
  if (!recent.length) return null
  return recent.reduce((sum, s) => sum + s.accuracy, 0) / recent.length
}

export function todaySessions(progress) {
  const day = localDay(new Date())
  return progress.sessions.filter((s) => localDay(new Date(s.date)) === day)
}

export function useStore() {
  const snap = useSyncExternalStore(store.subscribe, store.get, store.get)
  return snap
}

export function useSettings() {
  const s = useStore()
  return s.settings
}

export function useThemeEffect() {
  const { settings } = useStore()
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', settings.theme === 'light' ? '#f4f1ea' : '#080b0f')
  }, [settings.theme])
}

/**
 * Pick the next character to drill. Weak and slow characters come up
 * more often, but freshly learned letters still get plenty of airtime.
 */
export function weightedChar(chars, charStats, rng = Math.random) {
  if (!chars.length) return ''
  const weights = chars.map((c) => {
    const st = charStats[c]
    if (!st || st.shown < 2) return 2.2
    const acc = st.ok / st.shown
    const speedFactor = Math.min(2.5, (st.ms / st.shown) / 900)
    return 1 + (1 - acc) * 5 + speedFactor
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < chars.length; i += 1) {
    r -= weights[i]
    if (r <= 0) return chars[i]
  }
  return chars[chars.length - 1]
}
