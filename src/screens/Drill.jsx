import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/appContext'
import { store, useStore, knownChars, weakestChars, weightedChar } from '../lib/store'
import { MORSE, encode, randomWord, COMMON_WORDS, KOCH_ORDER, charLabel } from '../lib/morse'
import { engine } from '../lib/audio'
import { useCw } from '../hooks/useCw'
import { Lamp, Pattern, Ring } from '../components/Ui'
import { Play, ArrowRight, Refresh, Target, Ear, Info, Shuffle, Spark } from '../components/Icons'
import { pct, normalizeCopy } from '../lib/format'

const SOURCES = [
  { id: 'known', label: 'All known' },
  { id: 'weak', label: 'Weak letters' },
  { id: 'full', label: 'Full code' },
]

const MODES = [
  { id: 'char', label: 'Characters' },
  { id: 'group', label: 'Groups of 5' },
  { id: 'word', label: 'Words' },
]

const lessonLabel = (config) => {
  if (config?.source !== 'lesson') return null
  return `Lesson ${String(config.lessonId).padStart(2, '0')} · ${config.chars.join(' ')}`
}

export function Drill() {
  const { progress, settings } = useStore()
  const { drillConfig, launchDrill, setDrillConfig, showToast } = useApp()
  const [preset] = useState(() => drillConfig)
  const known = knownChars(progress)
  const weak = useMemo(() => weakestChars(progress, known, 8), [progress, known])

  const [source, setSource] = useState(preset?.source === 'lesson' ? 'lesson' : preset?.source || 'known')
  const [mode, setMode] = useState(preset?.mode || 'char')
  const [count, setCount] = useState(preset?.count || 20)
  const [charWpm, setCharWpm] = useState(settings.charWpm)
  const [effWpm, setEffWpm] = useState(settings.effWpm)
  const [items, setItems] = useState([])
  const [index, setIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [summary, setSummary] = useState(null)
  const [sessionStats, setSessionStats] = useState({ done: 0, correct: 0, times: [], replays: 0, chars: {} })
  const [streak, setStreak] = useState(0)

  const cw = useCw({ charWpm, effWpm })
  const lastToneEnd = useRef(0)
  const advanceTimer = useRef(null)
  const startTimer = useRef(null)
  const playedRef = useRef(-1)
  const startTimeRef = useRef(Date.now())
  const inputRef = useRef(null)
  const replaysRef = useRef(0)
  const itemsRef = useRef([])
  const playRef = useRef(null)

  const chars = useMemo(() => {
    if (source === 'lesson' && preset?.chars) return preset.chars
    if (source === 'weak') return weak.length ? weak.map((w) => w.char) : known
    if (source === 'full') return KOCH_ORDER.slice(0, 40)
    return known
  }, [source, preset, weak, known])

  const wordsAvailable = useMemo(() => {
    const usable = COMMON_WORDS.filter((w) => [...w].every((c) => chars.includes(c)))
    return usable.length
  }, [chars])

  useEffect(() => {
    if (mode === 'word' && wordsAvailable === 0) setMode('group')
  }, [mode, wordsAvailable])

  // The launch preset is a one-shot: consumed so a later visit starts clean.
  useEffect(() => { setDrillConfig(null) }, [setDrillConfig])

  const persistSpeeds = (nextChar, nextEff) => {
    const c = Math.max(10, Math.min(35, nextChar))
    const e = Math.max(5, Math.min(c, nextEff))
    setCharWpm(c)
    setEffWpm(e)
    store.setSettings({ charWpm: c, effWpm: e })
  }

  const playItem = useCallback(
    (item, { isReplay = false } = {}) => {
      if (!item) return
      const handle = cw.play(item.code, {
        charWpm,
        effWpm,
        onEnd: () => {},
      })
      const events = handle.timeline.events
      const last = events[events.length - 1]
      lastToneEnd.current = handle.startedAt + (last ? last.start + last.dur : 0)
      if (isReplay) {
        replaysRef.current += 1
        setSessionStats((s) => ({ ...s, replays: s.replays + 1 }))
      }
      setPhase((p) => (p === 'feedback' ? p : 'playing'))
    },
    [cw, charWpm, effWpm],
  )

  // Play the current item whenever the pointer moves. Refs keep this
  // effect from being torn down by unrelated renders (which would cancel
  // the scheduled tone before it ever starts).
  playRef.current = playItem
  itemsRef.current = items
  useEffect(() => {
    if (!running) return undefined
    if (playedRef.current === index) return undefined
    playedRef.current = index
    startTimer.current = setTimeout(() => {
      playRef.current?.(itemsRef.current[index])
      inputRef.current?.focus()
    }, 300)
    return () => clearTimeout(startTimer.current)
  }, [running, index])

  useEffect(() => () => {
    clearTimeout(advanceTimer.current)
    clearTimeout(startTimer.current)
  }, [])

  const start = (pool, nextCount = count, nextMode = mode, nextChars = chars) => {
    engine.ensure()
    cw.stop()
    const sessionItems = (() => {
      const stats = progress.chars
      const pick = () => weightedChar(nextChars, stats)
      return Array.from({ length: nextCount }, () => {
        let text
        if (nextMode === 'char') text = pick()
        else if (nextMode === 'group') text = Array.from({ length: 5 }, pick).join('')
        else text = randomWord(nextChars, COMMON_WORDS)
        return { text, code: encode(text) }
      })
    })()
    clearTimeout(advanceTimer.current)
    playedRef.current = -1
    replaysRef.current = 0
    setItems(sessionItems)
    setIndex(0)
    setInput('')
    setFeedback(null)
    setSummary(null)
    setSessionStats({ done: 0, correct: 0, times: [], replays: 0, chars: {} })
    setStreak(0)
    setPhase('playing')
    setRunning(true)
    startTimeRef.current = Date.now()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  const finish = (stats) => {
    setPhase('done')
    setRunning(false)
    cw.stop()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const accuracy = stats.done ? stats.correct / stats.done : 0
    const avgMs = stats.times.length ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length : 0
    const durationMs = Date.now() - startTimeRef.current
    setSummary({ ...stats, accuracy, avgMs, durationMs, speed: effWpm, mode, source })
    store.recordSession({
      kind: 'drill',
      label: `${mode === 'char' ? 'Recognition' : mode === 'group' ? 'Groups of 5' : 'Words'} · ${effWpm} wpm`,
      items: stats.done,
      correct: stats.correct,
      wpm: accuracy >= 0.9 && stats.done >= 10 ? effWpm : 0,
      durationMs,
    })
    if (source === 'lesson' && preset?.lessonId && accuracy >= 0.9 && stats.done >= 20) {
      store.completeLesson(preset.lessonId, { accuracy, items: stats.done })
      showToast(`Lesson ${preset.lessonId} passed — ${pct(accuracy)}`)
    }
  }

  const submit = (raw) => {
    if (phase === 'done' || !items[index]) return
    const expected = items[index].text
    const typed = normalizeCopy(raw)
    if (!typed) return
    const isChar = mode === 'char'
    const ok = isChar ? typed[0] === expected[0] : typed === expected
    const rt = Math.max(0, (engine.now() - lastToneEnd.current) * 1000)

    // Per-character bookkeeping feeds the adaptive engine.
    const perChar = [...expected].map((char, i) => ({
      char,
      typed: typed[i] || '',
      ok: typed[i] === char,
    }))
    perChar.forEach((c) => store.recordChar(c.char, c.ok, rt / Math.max(1, expected.length)))

    const nextChars = { ...sessionStats.chars }
    perChar.forEach((c) => {
      const prev = nextChars[c.char] || { n: 0, ok: 0 }
      nextChars[c.char] = { n: prev.n + 1, ok: prev.ok + (c.ok ? 1 : 0) }
    })

    const stats = {
      ...sessionStats,
      done: sessionStats.done + 1,
      correct: sessionStats.correct + (ok ? 1 : 0),
      times: [...sessionStats.times, rt],
      chars: nextChars,
    }
    setSessionStats(stats)
    setStreak(ok ? streak + 1 : 0)
    setFeedback({ ok, expected, typed, perChar, rt, replay: replaysRef.current })
    setPhase('feedback')

    // Re-serve a missed item a few steps later, without changing the session length.
    if (!ok && index + 3 < items.length) {
      setItems((prev) => {
        const copy = [...prev]
        copy[index + 3] = { ...prev[index] }
        return copy
      })
    }

    advanceTimer.current = setTimeout(() => {
      if (index + 1 >= items.length) {
        finish(stats)
      } else {
        setIndex((i) => i + 1)
        setInput('')
        setFeedback(null)
        replaysRef.current = 0
        setPhase('playing')
      }
    }, ok ? 680 : 1750)
  }

  const nextNow = () => {
    clearTimeout(advanceTimer.current)
    if (index + 1 >= items.length) {
      finish(sessionStats)
    } else {
      setIndex((i) => i + 1)
      setInput('')
      setFeedback(null)
      replaysRef.current = 0
      setPhase('playing')
    }
  }

  const endSession = () => {
    clearTimeout(advanceTimer.current)
    cw.stop()
    playedRef.current = -1
    if (sessionStats.done > 0) {
      finish(sessionStats)
    } else {
      setRunning(false)
      setPhase('idle')
    }
  }

  const current = items[index]
  const lastSummary = summary

  return (
    <>
      <div className="screen-head">
        <div>
          <div className="eyebrow">Recognition drill</div>
          <h1 className="display">Instant <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>recognition</em>.</h1>
          <p className="lede">
            One clean pass per character. No written notes, no patterns — just sound into letter.
            Weak letters come back more often, automatically.
          </p>
        </div>
        {preset && lessonLabel(preset) && (
          <span className="chip gold">{lessonLabel(preset)}</span>
        )}
      </div>

      {!running && !summary && (
        <>
          <section className="card config-panel">
            <div className="config-group">
              <span className="field-cap">Character set</span>
              <div className="segmented" role="group" aria-label="Character set">
                {preset?.source === 'lesson' && (
                  <button type="button" className={source === 'lesson' ? 'active' : ''} onClick={() => setSource('lesson')}>
                    Lesson {preset.lessonId}
                  </button>
                )}
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={source === s.id ? 'active' : ''}
                    onClick={() => setSource(s.id)}
                    disabled={s.id === 'weak' && !weak.length}
                    title={s.id === 'weak' && !weak.length ? 'Finish a drill first' : s.label}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {chars.length} characters · {source === 'weak' ? 'your lowest-accuracy letters' : 'weighted toward weak letters'}
              </div>
            </div>

            <div className="config-group">
              <span className="field-cap">What you hear</span>
              <div className="segmented" role="group" aria-label="Drill mode">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={mode === m.id ? 'active' : ''}
                    onClick={() => setMode(m.id)}
                    disabled={m.id === 'word' && wordsAvailable === 0}
                    title={m.id === 'word' && wordsAvailable === 0 ? 'Learn a few more letters first' : m.label}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {mode === 'char' ? 'Single characters, answered by typing' : mode === 'group' ? 'Five random characters as one word' : `${wordsAvailable} common words in your set`}
              </div>
            </div>

            <div className="config-group">
              <span className="field-cap">Length</span>
              <div className="segmented" role="group" aria-label="Number of items">
                {[10, 20, 40].map((n) => (
                  <button key={n} type="button" className={count === n ? 'active' : ''} onClick={() => setCount(n)}>{n}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Items in this set</div>
            </div>

            <div className="config-group grow">
              <span className="field-cap">Speed</span>
              <div className="config-speed" style={{ gap: 22, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 150, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    <span>LETTERS</span><span>{charWpm} WPM</span>
                  </div>
                  <input
                    type="range" min="12" max="35" step="1" value={charWpm}
                    style={{ '--fill': `${((charWpm - 12) / 23) * 100}%` }}
                    onChange={(e) => persistSpeeds(Number(e.target.value), effWpm)}
                    aria-label="Character speed"
                  />
                </div>
                <div style={{ minWidth: 150, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    <span>SPACING</span><span>{effWpm} WPM</span>
                  </div>
                  <input
                    type="range" min="5" max={charWpm} step="1" value={effWpm}
                    style={{ '--fill': `${((effWpm - 5) / Math.max(1, charWpm - 5)) * 100}%` }}
                    onChange={(e) => persistSpeeds(charWpm, Number(e.target.value))}
                    aria-label="Effective speed"
                  />
                </div>
              </div>
            </div>

            <button type="button" className="btn primary lg" onClick={() => start(chars)}>
              <Play width={15} height={15} /> Start set
            </button>
          </section>

          <div className="dash-grid">
            <section className="card card-pad">
              <div className="card-head">
                <div>
                  <div className="card-title">How a rep works</div>
                  <div className="card-cap" style={{ marginTop: 4 }}>About {Math.ceil(count * (mode === 'char' ? 4 : 12) / 60)} minutes</div>
                </div>
                <Ear width={16} height={16} className="gold" />
              </div>
              <div className="plan-item">
                <div className="plan-num">01</div>
                <div className="plan-body">
                  <div className="plan-title">Listen once</div>
                  <div className="plan-sub">The tone plays at {charWpm} wpm letters with {effWpm} wpm spacing.</div>
                </div>
              </div>
              <div className="plan-item">
                <div className="plan-num">02</div>
                <div className="plan-body">
                  <div className="plan-title">Type what you heard</div>
                  <div className="plan-sub">First instinct. Single characters submit the moment you type.</div>
                </div>
              </div>
              <div className="plan-item">
                <div className="plan-num">03</div>
                <div className="plan-body">
                  <div className="plan-title">Let the engine adapt</div>
                  <div className="plan-sub">Missed letters are re-served and weighted heavier in the next set.</div>
                </div>
              </div>
              <div className="tip" style={{ marginTop: 16 }}>
                <Info width={16} height={16} />
                <div><b>Space</b> replays the item. <b>Enter</b> skips the feedback pause. Try to answer before the next character would have started.</div>
              </div>
            </section>

            <section className="card card-pad">
              <div className="card-head">
                <div>
                  <div className="card-title">Session report</div>
                  <div className="card-cap" style={{ marginTop: 4 }}>Lifetime, per character</div>
                </div>
                <Target width={16} height={16} className="muted" />
              </div>
              <div className="char-heat">
                {known.map((c) => {
                  const st = progress.chars[c]
                  const acc = st?.shown ? st.ok / st.shown : null
                  const cls = acc == null ? 'unknown' : acc < 0.75 ? 'hot' : acc < 0.92 ? 'warm' : 'good'
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`heat-cell ${cls}`}
                      title={`${charLabel(c)} · ${acc == null ? 'not drilled' : pct(acc)}`}
                      onClick={() => cw.play(MORSE[c], { charWpm, effWpm: charWpm })}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
              <hr className="divider" />
              <div className="between">
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Best copy speed</span>
                <span className="mono" style={{ color: 'var(--gold)' }}>{progress.sessions.filter((s) => s.wpm).reduce((m, s) => Math.max(m, s.wpm), 0) || '—'} wpm</span>
              </div>
            </section>
          </div>
        </>
      )}

      {running && !summary && (
        <div className="practice-layout">
          <section className="card practice-main">
            <div className="stage">
              <div className="stage-top">
                <div>
                  <div className="stage-count">Item {String(index + 1).padStart(2, '0')} / {items.length}</div>
                  <div className="stage-progress"><i style={{ width: `${((index + (feedback ? 1 : 0)) / items.length) * 100}%` }} /></div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {streak >= 3 && <span className="chip gold"><Spark width={11} height={11} /> {streak} streak</span>}
                  <span className="chip">{charWpm}/{effWpm} wpm</span>
                </div>
              </div>

              <Lamp on={cw.tone} big />
              <div className="hint-line" aria-live="polite">
                {cw.playing
                  ? `Receiving… ${mode === 'group' ? 'a group of five' : mode === 'word' ? 'a word' : 'one character'}`
                  : feedback
                    ? feedback.ok ? 'Correct — keep the rhythm' : 'Hold that sound, then try the next'
                    : 'Type what you hear'}
              </div>

              <div style={{ marginTop: 18, minHeight: 42 }}>
                {feedback ? (
                  <div role="status" className="feedback-strip">
                    <span className={`chip ${feedback.ok ? 'mint' : 'red'}`}>{feedback.ok ? 'Copied' : 'Missed'}</span>
                    <span className="char-reveal">{feedback.expected}</span>
                    <Pattern code={encode(feedback.expected)} tone="gold" size="lg" />
                    {!feedback.ok && feedback.typed && (
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>you typed “{feedback.typed}”</span>
                    )}
                    <span className="chip" title="Time from the last tone to your answer">
                      {Math.round(feedback.rt)} ms · {feedback.rt < 900 ? 'instant' : feedback.rt < 1600 ? 'quick' : 'deliberate'}
                    </span>
                  </div>
                ) : (
                  <div className="tape" aria-hidden="true">
                    {Array.from({ length: mode === 'char' ? 3 : mode === 'group' ? 5 : 4 }).map((_, i) => (
                      <span key={i} className={`el ${cw.tone && i === 0 ? 'on' : 'd'}`} style={{ width: 14, opacity: 0.35 }} />
                    ))}
                  </div>
                )}
              </div>

              <form
                className="answer-zone"
                onSubmit={(e) => { e.preventDefault(); if (feedback) nextNow(); else submit(input) }}
              >
                <label className="sr-only" htmlFor="drill-answer">Your answer</label>
                <input
                  id="drill-answer"
                  ref={inputRef}
                  className={`answer-input ${feedback ? (feedback.ok ? 'correct' : 'wrong') : ''}`}
                  value={input}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  placeholder={mode === 'char' ? 'Type the character' : 'Type what you copied, then press Enter'}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9.,?/ ]/g, '')
                    if (feedback) return
                    setInput(v)
                    if (mode === 'char' && v.length >= 1) submit(v)
                  }}
                  onKeyDown={(e) => {
                    if (e.code === 'Space') {
                      e.preventDefault()
                      playItem(current, { isReplay: true })
                    }
                    if (e.key === 'Enter' && feedback) {
                      e.preventDefault()
                      nextNow()
                    }
                  }}
                />
              </form>

              <div className="stage-actions">
                <button type="button" className="btn ghost sm" onClick={() => { playItem(current, { isReplay: true }); inputRef.current?.focus() }}>
                  <Refresh width={13} height={13} /> Replay <span className="kbd-hint">space</span>
                </button>
                {mode !== 'char' && !feedback && (
                  <button type="button" className="btn primary sm" onClick={() => { submit(input); inputRef.current?.focus() }} disabled={!input}>
                    Check <ArrowRight width={13} height={13} />
                  </button>
                )}
                {feedback && (
                  <button type="button" className="btn sm" onClick={() => { nextNow(); setTimeout(() => inputRef.current?.focus(), 40) }}>
                    Next <ArrowRight width={13} height={13} />
                  </button>
                )}
                <button type="button" className="btn ghost sm" onClick={endSession}>End session</button>
              </div>
            </div>
          </section>

          <aside className="practice-side">
            <div className="score-strip">
              <div className="score-cell">
                <div className="v gold">{sessionStats.correct}</div>
                <div className="k">Correct</div>
              </div>
              <div className="score-cell">
                <div className="v">{sessionStats.done ? pct(sessionStats.correct / sessionStats.done) : '—'}</div>
                <div className="k">Accuracy</div>
              </div>
              <div className="score-cell">
                <div className="v">{sessionStats.times.length ? `${Math.round(sessionStats.times.reduce((a, b) => a + b, 0) / sessionStats.times.length)}` : '—'}<span style={{ fontSize: 9, color: 'var(--muted)' }}>ms</span></div>
                <div className="k">Response</div>
              </div>
            </div>

            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 12 }}>This set</div>
              <div className="char-heat">
                {[...new Set(items.map((i) => i.text))].slice(0, 24).map((text) => {
                  const st = sessionStats.chars[text]
                  const acc = st?.n ? st.ok / st.n : null
                  const cls = acc == null ? 'unknown' : acc < 0.7 ? 'hot' : acc < 0.95 ? 'warm' : 'good'
                  return (
                    <span key={text} className={`heat-cell ${cls}`} style={{ width: text.length > 1 ? 'auto' : 30, padding: text.length > 1 ? '0 8px' : 0, fontSize: text.length > 1 ? 10 : 11.5 }}>
                      {text.length > 1 ? text : text}
                    </span>
                  )
                })}
              </div>
              <hr className="divider" />
              <div className="between" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                <span>Replays used</span>
                <span className="mono">{sessionStats.replays}</span>
              </div>
              <div className="between" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
                <span>Current streak</span>
                <span className="mono">{streak}</span>
              </div>
              <div className="tip" style={{ marginTop: 14 }}>
                <Info width={15} height={15} />
                <div>Don’t count dashes in your head. Hear the shape, answer, move on.</div>
              </div>
            </section>
          </aside>
        </div>
      )}

      {summary && (
        <div className="practice-layout">
          <section className="card summary">
            <div className="summary-ring">
              <Ring value={summary.accuracy} size={152} stroke={6}>
                <div className="pct">{pct(summary.accuracy)}</div>
              </Ring>
            </div>
            {summary.source === 'lesson' && (
              <div style={{ marginBottom: 10 }}>
                {summary.accuracy >= 0.9 && summary.done >= 20
                  ? <span className="chip mint">Lesson {preset?.lessonId} passed — unlocked</span>
                  : <span className="chip gold">90% needed to pass lesson {preset?.lessonId}</span>}
              </div>
            )}
            <h3>{summary.accuracy >= 0.9 ? 'Clean copy.' : summary.accuracy >= 0.75 ? 'Good copy.' : 'Keep the ear open.'}</h3>
            <p>
              {summary.done} items at {summary.speed} wpm effective · {Math.round(summary.durationMs / 1000)}s
              {summary.accuracy >= 0.9 ? ' · logged as a copy at this speed.' : ' · aim for 90% before raising speed.'}
            </p>
            <div className="summary-stats">
              <div className="summary-stat"><div className="v gold">{summary.correct}/{summary.done}</div><div className="k">Correct</div></div>
              <div className="summary-stat"><div className="v">{summary.avgMs ? Math.round(summary.avgMs) : '—'}<span style={{ fontSize: 10, color: 'var(--muted)' }}>ms</span></div><div className="k">Avg response</div></div>
              <div className="summary-stat"><div className="v">{summary.replays}</div><div className="k">Replays</div></div>
            </div>
            {Object.entries(summary.chars).filter(([, v]) => v.ok < v.n).length > 0 && (
              <>
                <div className="field-cap">Characters to revisit</div>
                <div className="missed-list">
                  {Object.entries(summary.chars)
                    .filter(([, v]) => v.ok < v.n)
                    .sort((a, b) => (a[1].ok / a[1].n) - (b[1].ok / b[1].n))
                    .map(([char, v]) => (
                      <button
                        key={char}
                        type="button"
                        className="heat-cell hot"
                        title={`Hear ${charLabel(char)}`}
                        onClick={() => cw.play(MORSE[char], { charWpm, effWpm: charWpm })}
                        style={{ width: 'auto', padding: '0 9px', display: 'flex', gap: 6 }}
                      >
                        {char}<span style={{ fontSize: 8.5, opacity: 0.7 }}>{v.ok}/{v.n}</span>
                      </button>
                    ))}
                </div>
              </>
            )}
            <div className="row" style={{ justifyContent: 'center' }}>
              {Object.entries(summary.chars).some(([, v]) => v.ok < v.n) && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    const missed = [...new Set(Object.entries(summary.chars).filter(([, v]) => v.ok < v.n).map(([c]) => c).filter((c) => chars.includes(c)))]
                    if (!missed.length) { start(chars); return }
                    const pool = missed
                    const stats = progress.chars
                    const pick = () => weightedChar(pool, stats)
                    const sessionItems = Array.from({ length: Math.max(10, missed.length * 4) }, () => {
                      const text = mode === 'char' ? pick() : mode === 'group' ? Array.from({ length: 5 }, pick).join('') : randomWord(pool, COMMON_WORDS)
                      return { text, code: encode(text) }
                    })
                    setItems(sessionItems)
                    setIndex(0); setInput(''); setFeedback(null); setSummary(null)
                    setSessionStats({ done: 0, correct: 0, times: [], replays: 0, chars: {} })
                    setStreak(0); setPhase('playing'); setRunning(true)
                    playedRef.current = -1
                    startTimeRef.current = Date.now()
                    setTimeout(() => inputRef.current?.focus(), 80)
                  }}
                >
                  <Target width={15} height={15} /> Drill the misses
                </button>
              )}
              <button type="button" className="btn" onClick={() => start(chars)}>
                <Shuffle width={15} height={15} /> New set
              </button>
              <button type="button" className="btn ghost" onClick={() => { setSummary(null); setPhase('idle') }}>
                Change settings
              </button>
            </div>
          </section>

          <aside className="practice-side">
            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 10 }}>What the engine learned</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                Every answer updated your per-character signal report. Letters you miss will show up
                more often next session; letters you copy cleanly will space out.
              </p>
              <hr className="divider" />
              <div className="between" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                <span>Characters unlocked</span>
                <span className="mono">{known.length} / 40</span>
              </div>
              <div className="between" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
                <span>Session logged</span>
                <span className="mono mint">yes</span>
              </div>
            </section>
            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 8 }}>Next step</div>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                {summary.accuracy >= 0.9
                  ? 'Raise spacing by 2 wpm, or take the next lesson.'
                  : 'Stay at this speed and run one more set before moving on.'}
              </p>
              <button type="button" className="btn ghost sm" style={{ width: '100%', marginTop: 12 }} onClick={() => launchDrill({ source: 'known', chars: known, mode: 'group', count: 10 })}>
                Try head copy <ArrowRight width={13} height={13} />
              </button>
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
