/* A small, click-free CW tone engine built on the Web Audio API.

   Design notes:
   - One oscillator lives for the whole session; marks are shaped with
     gain ramps instead of starting/stopping oscillators, which keeps the
     tone phase-continuous and free of clicks.
   - Scheduling is done ahead of time against the AudioContext clock, so
     timing is accurate even when the main thread is busy.
   - `play()` returns the exact timeline it scheduled, so the UI can light
     up the same element the ear is hearing.
*/

import { buildTimeline } from './morse'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export class CwEngine {
  constructor() {
    this.ctx = null
    this.osc = null
    this.gain = null
    this.master = null
    this.level = 0.45
    this.freq = 620
    this.wave = 'sine'
    this.current = null
    this.seq = 0
  }

  get ready() {
    return !!this.ctx
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return this.ctx
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    const ctx = new AC()
    const master = ctx.createGain()
    master.gain.value = this.level
    master.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = this.wave
    osc.frequency.value = this.freq

    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(master)
    osc.start()

    this.ctx = ctx
    this.osc = osc
    this.gain = gain
    this.master = master
    return ctx
  }

  configure({ freq, volume, wave } = {}) {
    if (typeof freq === 'number') this.freq = clamp(freq, 300, 1000)
    if (typeof volume === 'number') this.level = clamp(volume, 0, 1)
    if (wave) this.wave = wave
    if (!this.ctx) return
    this.osc.frequency.setTargetAtTime(this.freq, this.ctx.currentTime, 0.01)
    this.osc.type = this.wave
    this.master.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.02)
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /* ------------------------- playback ------------------------- */

  play(code, { charWpm = 20, effWpm = 12, lead = 0.09 } = {}) {
    const ctx = this.ensure()
    if (!ctx || !this.gain) {
      return { timeline: buildTimeline(code, { charWpm, effWpm }), startedAt: 0, promise: Promise.resolve(), stop() {} }
    }
    this.stop()
    const timeline = buildTimeline(code, { charWpm, effWpm })
    const g = this.gain
    const now = ctx.currentTime
    const startedAt = now + Math.max(0.03, lead)
    const L = this.level
    const ramp = 0.006

    g.gain.cancelScheduledValues(now)
    g.gain.setValueAtTime(0, now)

    for (const ev of timeline.events) {
      const s = startedAt + ev.start
      const e = s + ev.dur
      const up = Math.min(ramp, ev.dur / 3)
      g.gain.setValueAtTime(0, Math.max(now, s - up))
      g.gain.linearRampToValueAtTime(L, s + Math.min(0.002, ev.dur / 4))
      g.gain.setValueAtTime(L, Math.max(s + 0.003, e - up))
      g.gain.linearRampToValueAtTime(0, e)
    }

    const id = ++this.seq
    let resolveFn
    const promise = new Promise((resolve) => {
      resolveFn = resolve
    })
    let timer = setTimeout(() => {
      if (this.current && this.current.id === id) this.current = null
      resolveFn({ stopped: false })
    }, timeline.totalWithTail * 1000 + 40)

    const stop = () => {
      clearTimeout(timer)
      if (!this.ctx) return
      const t = this.ctx.currentTime
      const cur = g.gain.value
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(cur, t)
      g.gain.linearRampToValueAtTime(0, t + 0.015)
      if (this.current && this.current.id === id) this.current = null
      resolveFn({ stopped: true })
    }

    const handle = {
      id,
      startedAt,
      timeline,
      promise,
      stop,
      elapsed() {
        return Math.max(0, ctx.currentTime - startedAt)
      },
      activeChar() {
        const t = ctx.currentTime - startedAt
        if (t < 0) return -1
        const idx = timeline.chars.findIndex((c) => t >= c.start && t < c.end)
        if (idx >= 0) return idx
        // between characters: hold the last character, then clear
        for (let i = timeline.chars.length - 1; i >= 0; i -= 1) {
          const c = timeline.chars[i]
          const next = timeline.chars[i + 1]
          const gapEnd = next ? next.start : c.end + 0.1
          if (t >= c.start && t < gapEnd) return i
        }
        return -1
      },
      isTone() {
        const t = ctx.currentTime - startedAt
        return timeline.events.some((ev) => t >= ev.start && t < ev.start + ev.dur)
      },
    }
    this.current = handle
    return handle
  }

  stop() {
    if (this.current) this.current.stop()
    this.current = null
  }

  /* ----------------------- live keying ----------------------- */

  keyDown() {
    const ctx = this.ensure()
    if (!ctx || !this.gain) return
    // A held key takes over from any scheduled playback.
    const t = ctx.currentTime
    this.gain.gain.cancelScheduledValues(t)
    this.gain.gain.setValueAtTime(this.gain.gain.value, t)
    this.gain.gain.linearRampToValueAtTime(this.level, t + 0.004)
    this.current = null
  }

  keyUp() {
    if (!this.ctx || !this.gain) return
    const t = this.ctx.currentTime
    this.gain.gain.cancelScheduledValues(t)
    this.gain.gain.setValueAtTime(this.gain.gain.value, t)
    this.gain.gain.linearRampToValueAtTime(0, t + 0.004)
  }

  blip({ freq = 880, dur = 0.07, volume = 0.18 } = {}) {
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(volume * this.level, t + 0.008)
    g.gain.setValueAtTime(volume * this.level, t + dur - 0.02)
    g.gain.linearRampToValueAtTime(0, t + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }
}

export const engine = new CwEngine()
