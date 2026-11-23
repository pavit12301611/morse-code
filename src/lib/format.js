export const pct = (v, digits = 0) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`)

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function formatDuration(ms) {
  if (!ms || ms < 1000) return '0m'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function dayKey(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d
  })
}

export function shortDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = dayKey(d) === dayKey(now)
  const yest = new Date(Date.now() - 864e5)
  if (sameDay) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  if (dayKey(d) === dayKey(yest)) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function normalizeCopy(text) {
  return String(text).toUpperCase().replace(/[^A-Z0-9.,?/ ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Position-by-position comparison used by copy and sending reports. */
export function compareCopy(expected, typed) {
  const exp = normalizeCopy(expected)
  const got = normalizeCopy(typed).replace(/\s+/g, '')
  let correct = 0
  let total = 0
  let k = 0
  const perChar = [...exp].map((char) => {
    if (char === ' ') return { char, space: true }
    total += 1
    const t = got[k] || ''
    const ok = t === char
    if (ok) correct += 1
    k += 1
    return { char, typed: t, ok }
  })
  return {
    perChar,
    correct,
    total,
    extra: got.slice(total),
    accuracy: total ? correct / total : 0,
  }
}
