import { useCallback, useEffect, useRef, useState } from 'react'
import { engine } from '../lib/audio'

/** Play Morse with the shared engine and expose a frame-accurate UI state. */
export function useCw({ charWpm = 20, effWpm = 12 } = {}) {
  const [state, setState] = useState({ playing: false, tone: false, eventIndex: -1, charIndex: -1, elapsed: 0 })
  const handleRef = useRef(null)
  const rafRef = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cancelAnimationFrame(rafRef.current)
      engine.stop()
    }
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    engine.stop()
    handleRef.current = null
    setState({ playing: false, tone: false, eventIndex: -1, charIndex: -1, elapsed: 0 })
  }, [])

  const play = useCallback(
    (code, opts = {}) => {
      const handle = engine.play(code, {
        charWpm: opts.charWpm ?? charWpm,
        effWpm: opts.effWpm ?? effWpm,
      })
      handleRef.current = handle
      cancelAnimationFrame(rafRef.current)
      setState({ playing: true, tone: true, eventIndex: -1, charIndex: -1, elapsed: 0 })

      const tick = () => {
        if (handleRef.current !== handle) return
        const t = handle.elapsed()
        let eventIndex = -1
        let tone = false
        let charIndex = -1
        const events = handle.timeline.events
        for (let i = 0; i < events.length; i += 1) {
          const ev = events[i]
          if (t >= ev.start) {
            eventIndex = i
            charIndex = ev.charIndex
            tone = t < ev.start + ev.dur
          } else break
        }
        // Only re-render when something visible actually changes (the tone,
        // the highlighted element, or roughly 8 fps of progress). This keeps
        // playback from re-rendering the whole screen sixty times a second.
        setState((prev) => {
          if (
            prev.playing &&
            prev.tone === tone &&
            prev.eventIndex === eventIndex &&
            prev.charIndex === charIndex &&
            Math.abs(prev.elapsed - t) < 0.12
          ) return prev
          return { playing: true, tone, eventIndex, charIndex, elapsed: t }
        })
        if (t < handle.timeline.totalWithTail) {
          rafRef.current = requestAnimationFrame(tick)
        }
      }
      rafRef.current = requestAnimationFrame(tick)

      handle.promise.then((res) => {
        if (handleRef.current !== handle) return
        handleRef.current = null
        if (mounted.current) {
          setState({ playing: false, tone: false, eventIndex: -1, charIndex: -1, elapsed: 0 })
        }
        opts.onEnd?.(res)
      })
      return handle
    },
    [charWpm, effWpm],
  )

  return { ...state, play, stop, handleRef }
}
