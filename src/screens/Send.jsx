import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { store, useStore, knownChars, weightedChar } from '../lib/store'
import {
  encode, MORSE, CODE_TO_CHAR, randomWord, COMMON_WORDS, CALLSIGNS, charLabel, unitMs,
} from '../lib/morse'
import { engine } from '../lib/audio'
import { Lamp, Pattern, Tip } from '../components/Ui'
import { ArrowRight, Refresh, KeyIcon, Info, Target, Check, Play, Trash } from '../components/Icons'
import { pct, compareCopy } from '../lib/format'

const MODES = [
  { id: 'letters', label: 'Letters' },
  { id: 'groups', label: 'Groups' },
  { id: 'words', label: 'Words' },
  { id: 'callsigns', label: 'Callsigns' },
  { id: 'free', label: 'Free key' },
]

const KEYERS = [
  { id: 'straight', label: 'Straight key', hint: 'Hold for a dash, tap for a dot. Real timing, real mistakes.' },
  { id: 'paddle', label: 'Paddle keyer', hint: 'Each tap sends a perfect element — you own the spacing.' },
]

export function Send() {
  const { progress, settings } = useStore()
  const known = knownChars(progress)
  const [mode, setMode] = useState('letters')
  const [keyer, setKeyer] = useState(settings.keyer === 'straight' ? 'straight' : 'paddle')
  const [charWpm, setCharWpm] = useState(settings.charWpm)
  const wordCount = useMemo(
    () => COMMON_WORDS.filter((w) => [...w].every((c) => known.includes(c))).length,
    [known],
  )
  const [phase, setPhase] = useState('idle') // idle | active | done
  const [target, setTarget] = useState('')
  const [ui, setUi] = useState({ text: '', letter: '', sent: 0, correct: 0, timing: { n: 0, ok: 0 }, elements: [] })
  const [pad, setPad] = useState(null)
  const [summary, setSummary] = useState(null)
  const [showCodes, setShowCodes] = useState(true)

  const unitRef = useRef(unitMs(charWpm))
  const s = useRef(null)
  const tick = useRef(null)
  const finishTimer = useRef(null)
  const paddTimer = useRef(null)
  const keyDownAt = useRef(0)
  const pressedRef = useRef(false)
  const queueRef = useRef([])

  unitRef.current = unitMs(charWpm)

  const cleanup = useCallback(() => {
    clearInterval(tick.current)
    clearTimeout(finishTimer.current)
    clearTimeout(paddTimer.current)
    engine.keyUp()
    pressedRef.current = false
    queueRef.current = []
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const buildTarget = (poolChars = known) => {
    const pick = () => weightedChar(poolChars, progress.chars)
    if (mode === 'letters') {
      return Array.from({ length: 8 }, pick).join(' ')
    }
    if (mode === 'groups') {
      return Array.from({ length: 3 }, () => Array.from({ length: 5 }, pick).join('')).join(' ')
    }
    if (mode === 'words') {
      return Array.from({ length: 3 }, () => randomWord(poolChars, COMMON_WORDS)).join(' ')
    }
    if (mode === 'callsigns') {
      const pool = CALLSIGNS.filter((c) => [...c].every((ch) => poolChars.includes(ch)))
      return (pool.length
        ? Array.from({ length: 2 }, () => pool[Math.floor(Math.random() * pool.length)])
        : Array.from({ length: 2 }, () => Array.from({ length: 5 }, pick).join(''))
      ).join(' ')
    }
    return ''
  }

  const start = () => {
    engine.ensure()
    cleanup()
    const nextTarget = mode === 'free' ? '' : buildTarget(known)
    setTarget(nextTarget)
    setSummary(null)
    setUi({ text: '', letter: '', sent: 0, correct: 0, timing: { n: 0, ok: 0 }, elements: [] })
    setPhase('active')
    s.current = {
      target: nextTarget.replace(/\s+/g, ''),
      sent: [],
      text: '',
      letter: '',
      timing: { n: 0, ok: 0 },
      lastEnd: 0,
      elements: [],
      active: true,
      finished: false,
      startedAt: Date.now(),
    }
    setPad(null)
  }

  const finalize = useCallback((finalState) => {
    const st = finalState || s.current
    if (!st || st.finished) return
    st.finished = true
    st.active = false
    cleanup()
    const diff = compareCopy(st.target, st.sent.join(''))
    const timingScore = st.timing.n ? st.timing.ok / st.timing.n : 1
    const result = {
      ...diff,
      timingScore,
      elements: st.timing.n,
      target: st.target,
      sent: st.sent.join(''),
      accuracy: st.target ? diff.accuracy : 0,
    }
    setSummary(result)
    setPhase('done')
    setUi((u) => ({ ...u, text: st.text }))
    if (!st.target) return

    diff.perChar.forEach((c) => {
      if (!c.space) store.recordChar(c.char, !!c.ok, 0)
    })
    const durationMs = Math.max(2000, Date.now() - (st.startedAt || Date.now()))
    store.recordSession({
      kind: 'send',
      label: `${keyer === 'paddle' ? 'Paddle' : 'Straight key'} · ${charWpm} wpm`,
      items: diff.total,
      correct: diff.correct,
      wpm: diff.accuracy >= 0.9 && timingScore >= 0.75 ? charWpm : 0,
      durationMs,
    })
  }, [cleanup, keyer, charWpm])

  const pushUi = (st) => {
    setUi({
      text: st.text,
      letter: st.letter,
      sent: st.sent.length,
      correct: st.sent.filter(Boolean).filter((x) => x.ok).length,
      timing: st.timing,
      elements: [...st.elements],
    })
  }

  const compareSent = (st) => {
    // Compare on the fly against the target's compact characters.
    const sentIndex = st.sent.length - 1
    if (sentIndex < 0) return
    const want = st.target[sentIndex]
    const got = st.sent[sentIndex].char
    st.sent[sentIndex].ok = want === got
    if (want) store.recordChar(want, want === got, 0)
  }

  const commitLetter = useCallback((st) => {
    const state = st || s.current
    if (!state || !state.letter) return
    const char = CODE_TO_CHAR[state.letter] || '?'
    state.sent.push({ char, ok: false })
    state.text = state.sent.map((x) => x.char).join('')
    state.letter = ''
    compareSent(state)
    pushUi(state)
    if (state.target && state.sent.length >= state.target.length && !state.finished) {
      clearTimeout(finishTimer.current)
      finishTimer.current = setTimeout(() => finalize(state), 900)
    }
  }, [finalize])

  const recordElement = useCallback((durMs, symOverride) => {
    const state = s.current
    if (!state || !state.active) return
    const unit = unitRef.current
    const sym = symOverride || (durMs >= 2 * unit ? '-' : '.')
    const ideal = sym === '-' ? 3 * unit : unit
    const err = Math.abs(durMs - ideal) / ideal
    state.timing.n += 1
    if (err <= 0.35) state.timing.ok += 1
    state.elements = [...state.elements, { sym, dur: durMs, ideal, err, ok: err <= 0.35 }].slice(-5)
    state.letter += sym
    state.lastEnd = performance.now()
    if (!state.startedAt) state.startedAt = Date.now()
    pushUi(state)
  }, [])

  // Commit letters and word spaces from silence.
  useEffect(() => {
    if (phase !== 'active') return undefined
    tick.current = setInterval(() => {
      const state = s.current
      if (!state || !state.active) return
      const unit = unitRef.current
      const gap = performance.now() - state.lastEnd
      if (state.letter && gap > 2.4 * unit && !pressedRef.current) {
        commitLetter(state)
      } else if (!state.letter && state.text && !state.text.endsWith(' ') && gap > 5.5 * unit) {
        state.text += ' '
        pushUi(state)
      }
    }, 40)
    return () => clearInterval(tick.current)
  }, [phase, commitLetter])

  const startStraight = (e) => {
    if (phase !== 'active' || pressedRef.current) return
    e?.preventDefault?.()
    pressedRef.current = true
    keyDownAt.current = performance.now()
    engine.ensure()
    engine.keyDown()
    setPad('key')
  }

  const endStraight = (e) => {
    if (!pressedRef.current) return
    e?.preventDefault?.()
    pressedRef.current = false
    const dur = performance.now() - keyDownAt.current
    engine.keyUp()
    setPad(null)
    if (dur >= 18) recordElement(dur)
  }

  const playPaddleElement = (sym) => {
    pressedRef.current = true
    const unit = unitRef.current
    const dur = (sym === '-' ? 3 : 1) * unit
    engine.ensure()
    engine.keyDown()
    setPad(sym)
    paddTimer.current = setTimeout(() => {
      engine.keyUp()
      recordElement(dur, sym)
      setPad(null)
      const next = queueRef.current.shift()
      if (next) {
        // leave a proper one-unit gap, then play the queued element
        paddTimer.current = setTimeout(() => playPaddleElement(next), unit)
      } else {
        pressedRef.current = false
      }
    }, dur)
  }

  const tapPaddle = (sym) => {
    if (phase !== 'active') return
    if (pressedRef.current) {
      if (queueRef.current.length < 3) queueRef.current.push(sym)
      return
    }
    playPaddleElement(sym)
  }

  // Keyboard: space is a straight key; F / J are paddles.
  useEffect(() => {
    if (phase !== 'active') return undefined
    const down = (e) => {
      if (e.repeat) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (keyer === 'paddle') tapPaddle('.')
        else startStraight(e)
      }
      if (keyer === 'paddle' && (e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        tapPaddle('.')
      }
      if (keyer === 'paddle' && (e.key === 'j' || e.key === 'J' || e.key === 'ArrowRight')) {
        e.preventDefault()
        tapPaddle('-')
      }
    }
    const up = (e) => {
      if ((e.type === 'pointerup' || e.code === 'Space') && keyer === 'straight') {
        if (e.type === 'keyup') e.preventDefault()
        if (pressedRef.current) endStraight(e)
      }
    }
    const blur = () => {
      if (pressedRef.current) {
        pressedRef.current = false
        engine.keyUp()
        setPad(null)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('pointerup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('blur', blur)
    }
  }, [phase, keyer]) // eslint-disable-line react-hooks/exhaustive-deps

  const finishNow = () => {
    if (s.current?.letter) commitLetter()
    setTimeout(() => finalize(), 120)
  }

  const clear = () => {
    if (!s.current) return
    s.current.sent = []
    s.current.text = ''
    s.current.letter = ''
    s.current.elements = []
    s.current.timing = { n: 0, ok: 0 }
    pushUi(s.current)
  }

  const compactTarget = target.replace(/\s+/g, '')
  const targetChars = [...target]
  const sentSoFar = s.current?.sent.length || 0
  const nextChar = compactTarget[sentSoFar] || ''
  const sentOk = (index, char) => {
    if (index >= (s.current?.sent.length || 0)) return ''
    const item = s.current.sent[index]
    return item.ok ? 'done' : 'wrong'
  }

  const timingScore = ui.timing.n ? ui.timing.ok / ui.timing.n : null
  const sentCompact = ui.text.replace(/\s+/g, '')

  return (
    <>
      <div className="screen-head">
        <div>
          <div className="eyebrow">Sending</div>
          <h1 className="display">Key it like you<br />hear it.</h1>
          <p className="lede">
            Sending is where timing becomes instinct. Use a straight key or a paddle keyer, watch
            the envelope, and the decoder will tell you exactly what your hand just said.
          </p>
        </div>
        <span className="chip gold"><KeyIcon width={12} height={12} /> {settings.keyer === 'straight' ? 'Straight key' : 'Paddle keyer'}</span>
      </div>

      {phase === 'idle' && (
        <>
          <section className="card config-panel">
            <div className="config-group grow">
              <span className="field-cap">Keyer</span>
              <div className="segmented" role="group" aria-label="Keyer type">
                {KEYERS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={keyer === k.id ? 'active' : ''}
                    onClick={() => { setKeyer(k.id); store.setSettings({ keyer: k.id }) }}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{KEYERS.find((k) => k.id === keyer).hint}</div>
            </div>
            <div className="config-group grow">
              <span className="field-cap">Send</span>
              <div className="segmented" role="group" aria-label="What to send">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={mode === m.id ? 'active' : ''}
                    onClick={() => setMode(m.id)}
                    disabled={m.id === 'words' && wordCount === 0}
                    title={m.id === 'words' && wordCount === 0 ? 'Learn a few more letters first' : m.label}
                  >{m.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {mode === 'free' ? 'No target — decode whatever you key.' : 'The decoder scores you against the target.'}
              </div>
            </div>
            <div className="config-group">
              <span className="field-cap">Speed</span>
              <div className="config-speed">
                <div style={{ minWidth: 130 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    <span>ELEMENT</span><span>{charWpm} WPM</span>
                  </div>
                  <input
                    type="range" min="5" max="30" step="1" value={charWpm}
                    style={{ '--fill': `${((charWpm - 5) / 25) * 100}%` }}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setCharWpm(v)
                      store.setSettings({ charWpm: v, effWpm: Math.min(settings.effWpm, v) })
                    }}
                    aria-label="Sending speed"
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Dit = {(1200 / charWpm).toFixed(0)} ms</div>
            </div>
            <button type="button" className="btn primary lg" onClick={start}>
              <Play width={15} height={15} /> Start keying
            </button>
          </section>

          <div className="dash-grid">
            <section className="card card-pad">
              <div className="card-head">
                <div>
                  <div className="card-title">The two controls</div>
                  <div className="card-cap" style={{ marginTop: 4 }}>How to key</div>
                </div>
                <KeyIcon width={16} height={16} className="gold" />
              </div>
              <div className="plan-item">
                <div className="plan-num">.</div>
                <div className="plan-body">
                  <div className="plan-title">Dot — one unit</div>
                  <div className="plan-sub">{keyer === 'straight' ? 'Tap the key quickly: press and release in one dit.' : 'Tap the left pad (or F). The keyer times it for you.'}</div>
                </div>
              </div>
              <div className="plan-item">
                <div className="plan-num">—</div>
                <div className="plan-body">
                  <div className="plan-title">Dash — three units</div>
                  <div className="plan-sub">{keyer === 'straight' ? 'Hold the key for three dits. Release cleanly.' : 'Tap the right pad (or J). One perfect dah.'}</div>
                </div>
              </div>
              <div className="plan-item">
                <div className="plan-num">␣</div>
                <div className="plan-body">
                  <div className="plan-title">Silence is punctuation</div>
                  <div className="plan-sub">One unit between elements, three between letters, seven between words. The keyer reads your gaps.</div>
                </div>
              </div>
              <div className="tip" style={{ marginTop: 16 }}>
                <Info width={16} height={16} />
                <div><b>Start slower than you think.</b> 10–12 wpm sends cleanly. Sloppy at 25 teaches sloppy timing, and the decoder will not be kind.</div>
              </div>
            </section>

            <section className="card card-pad">
              <div className="card-head">
                <div className="card-title">Your keyer</div>
                <span className="chip">{KEYERS.find((k) => k.id === keyer).label}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                {keyer === 'straight'
                  ? 'A straight key is a physical lever: the tone is on exactly while you hold it. It is the most honest way to learn rhythm, and the hardest.'
                  : 'A paddle keyer makes each element electronically. You only decide what comes next and when — which is precisely the skill that matters on air.'}
              </p>
              <hr className="divider" />
              <div className="between" style={{ fontSize: 12, color: 'var(--muted)' }}>
                <span>Keyboard</span>
                <span className="mono">{keyer === 'straight' ? 'Space' : 'F · J'}</span>
              </div>
              <div className="between" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                <span>Touch</span>
                <span className="mono">{keyer === 'straight' ? 'Hold the pad' : 'Tap either pad'}</span>
              </div>
            </section>
          </div>
        </>
      )}

      {phase === 'active' && (
        <div className="practice-layout">
          <section className="card practice-main">
            <div className="stage" style={{ minHeight: 470 }}>
              <div className="stage-top">
                <div>
                  <div className="stage-count">Sending · {charWpm} wpm</div>
                  <div className="stage-progress"><i style={{ width: `${compactTarget ? Math.min(100, (sentCompact.length / compactTarget.length) * 100) : 0}%` }} /></div>
                </div>
                <span className="chip">{keyer === 'straight' ? 'Straight key' : 'Paddle'}</span>
              </div>

              {mode !== 'free' && (
                <div className="send-target" aria-label="Target text">
                  {targetChars.map((char, i) => {
                    if (char === ' ') return <span key={i} style={{ width: 8 }}> </span>
                    const before = targetChars.slice(0, i).filter((c) => c !== ' ').length
                    const status = sentOk(before, char) || (before === sentSoFar ? 'current' : '')
                    return <span key={i} className={status}>{char}</span>
                  })}
                </div>
              )}

              <div style={{ position: 'relative', marginTop: 6 }}>
                <Lamp on={pad !== null} big />
              </div>

              <div className="hint-line" aria-live="polite">
                {mode === 'free' ? 'Free key · the decoder is listening' : `Target: ${compactTarget.length} characters · ${sentCompact.length} sent`}
              </div>

              {mode !== 'free' && nextChar && (
                <div className="row" style={{ gap: 9, marginTop: 4, justifyContent: 'center' }}>
                  <span className="card-cap">Next</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 19, lineHeight: 1, color: 'var(--gold)' }}>{nextChar}</span>
                  {showCodes && <Pattern code={MORSE[nextChar]} size="lg" tone="gold" />}
                  <button
                    type="button"
                    className="chip"
                    style={{ cursor: 'pointer', background: 'transparent' }}
                    onClick={() => setShowCodes((v) => !v)}
                    aria-pressed={showCodes}
                    title="Toggle the pattern hint"
                  >
                    {showCodes ? 'hide code' : 'show code'}
                  </button>
                </div>
              )}

              <div style={{ marginTop: 18, width: '100%', maxWidth: 520 }}>
                <div className="card-cap" style={{ textAlign: 'center', marginBottom: 8 }}>Decoder output</div>
                <div style={{
                  minHeight: 58, borderRadius: 12, border: '1px solid var(--line)',
                  background: 'var(--bg-2)', padding: '12px 16px', fontFamily: 'var(--mono)',
                  fontSize: 22, letterSpacing: '0.14em', color: ui.letter ? 'var(--gold)' : 'var(--text)',
                  textAlign: 'center', overflowWrap: 'anywhere',
                }}>
                  {ui.text || <span style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: '0.1em' }}>— waiting for tones —</span>}
                  {ui.letter && <span style={{ color: 'var(--gold)', opacity: 0.75 }}>{ui.letter.replaceAll('.', '·').replaceAll('-', '—')}</span>}
                </div>
              </div>

              <div className="keypads" style={{ marginTop: 20 }}>
                {keyer === 'straight' ? (
                  <button
                    type="button"
                    className={`keypad wide ${pad === 'key' ? 'on' : ''}`}
                    onPointerDown={startStraight}
                    onPointerUp={endStraight}
                    onPointerCancel={endStraight}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label="Straight key — press and hold"
                  >
                    <span className="k-sym">{pad === 'key' ? '—' : '·—'}</span>
                    <span className="k-label">Press & hold</span>
                    <span className="k-key">SPACE</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`keypad dit ${pad === '.' ? 'on' : ''}`}
                      onPointerDown={(e) => { e.preventDefault(); tapPaddle('.') }}
                      aria-label="Send a dit"
                    >
                      <span className="k-sym">·</span>
                      <span className="k-label">Dit</span>
                      <span className="k-key">F</span>
                    </button>
                    <button
                      type="button"
                      className={`keypad ${pad === '-' ? 'on' : ''}`}
                      onPointerDown={(e) => { e.preventDefault(); tapPaddle('-') }}
                      aria-label="Send a dah"
                    >
                      <span className="k-sym">—</span>
                      <span className="k-label">Dah</span>
                      <span className="k-key">J</span>
                    </button>
                  </>
                )}
              </div>

              <div className="stage-actions">
                <button type="button" className="btn ghost sm" onClick={clear}>
                  <Trash width={13} height={13} /> Clear
                </button>
                {mode === 'free' ? (
                  <button type="button" className="btn sm" onClick={finishNow}>
                    Finish
                  </button>
                ) : (
                  <button type="button" className="btn sm" onClick={finishNow} disabled={!sentCompact && mode !== 'free'}>
                    Check my sending <ArrowRight width={13} height={13} />
                  </button>
                )}
                <button type="button" className="btn ghost sm" onClick={() => { cleanup(); setPhase('idle') }}>
                  Stop
                </button>
              </div>
            </div>
          </section>

          <aside className="practice-side">
            <div className="score-strip">
              <div className="score-cell">
                <div className="v gold">{sentCompact.length}</div>
                <div className="k">Sent</div>
              </div>
              <div className="score-cell">
                <div className="v">{ui.sent ? pct(ui.correct / ui.sent) : '—'}</div>
                <div className="k">Chars</div>
              </div>
              <div className="score-cell">
                <div className="v">{timingScore == null ? '—' : pct(timingScore)}</div>
                <div className="k">Timing</div>
              </div>
            </div>

            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 12 }}>Element envelope</div>
              <div className="timing-meter">
                {Array.from({ length: 5 }).map((_, i) => {
                  const el = ui.elements[i]
                  const width = el ? Math.min(100, (el.dur / (unitRef.current * 4)) * 100) : 0
                  const ideal = el ? (el.ideal / (unitRef.current * 4)) * 100 : 0
                  return (
                    <div className="timing-row" key={i}>
                      <span style={{ width: 22 }}>{el ? (el.sym === '.' ? '·' : '—') : ''}</span>
                      <div className="timing-track">
                        {el && <div className={`timing-fill ${el.ok ? 'ok' : 'bad'}`} style={{ width: `${width}%` }} />}
                        {el && <div className="timing-ideal" style={{ left: `${ideal}%` }} />}
                      </div>
                      <span style={{ width: 34, textAlign: 'right' }}>{el ? `${Math.round(el.dur)}` : ''}</span>
                    </div>
                  )
                })}
              </div>
              <div className="card-cap" style={{ marginTop: 8 }}>ideal 1 / 3 dits · ±35% passes</div>
              <hr className="divider" />
              <div className="tip">
                <Info width={15} height={15} />
                <div>{keyer === 'straight' ? 'Too long turns a dit into a dah. Aim for crisp, equal dits.' : 'Your gaps decide the letters. Pause about three dits when one letter ends.'}</div>
              </div>
            </section>

            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 10 }}>Target</div>
              {mode === 'free' ? (
                <div className="empty">Free key — nothing to match.</div>
              ) : (
                <>
                  <div className="row" style={{ gap: 8 }}>
                    {[...compactTarget].slice(0, 12).map((c, i) => (
                      <span key={i} className="kbd" style={{ minWidth: 24, height: 24, color: ui.sent > i ? (s.current?.sent[i]?.ok ? 'var(--mint)' : 'var(--red)') : undefined }}>
                        {c}
                      </span>
                    ))}
                  </div>
                  {compactTarget.length > 12 && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8 }}>+{compactTarget.length - 12} more</div>}
                  <hr className="divider" />
                  <button type="button" className="btn ghost sm" style={{ width: '100%' }} onClick={start}>
                    <Refresh width={13} height={13} /> New target
                  </button>
                </>
              )}
            </section>
          </aside>
        </div>
      )}

      {phase === 'done' && summary && (
        <div className="practice-layout">
          <section className="card summary">
            <div className="summary-ring">
              <div className="pct" style={{ color: summary.accuracy >= 0.9 ? 'var(--mint)' : summary.accuracy >= 0.7 ? 'var(--gold)' : 'var(--red)' }}>
                {summary.total ? pct(summary.accuracy) : '—'}
              </div>
              <svg width="152" height="152" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
                <circle cx="76" cy="76" r="70" fill="none" stroke="var(--line)" strokeWidth="6" />
                <circle
                  cx="76" cy="76" r="70" fill="none" stroke="var(--gold)" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 70} ${2 * Math.PI * 70}`}
                  strokeDashoffset={2 * Math.PI * 70 * (1 - (summary.accuracy || 0))}
                />
              </svg>
            </div>
            <h3>{!summary.total ? 'Free key closed out.' : summary.accuracy >= 0.95 ? 'Clean fist.' : summary.accuracy >= 0.8 ? 'Readable copy.' : 'Slow down a notch.'}</h3>
            <p>
              {summary.total
                ? `${summary.correct} of ${summary.total} characters decoded · ${summary.sent.length} sent · timing ${pct(summary.timingScore)}`
                : `You sent ${summary.sent.length} characters. Nothing to score — free practice isn’t logged as a session.`}
            </p>

            {summary.total > 0 && (
              <>
                <div className="copy-diff" style={{ marginTop: 18, textAlign: 'left' }}>
                  {summary.perChar.map((c, i) => {
                    if (c.space) return <span key={i} className="word-gap" />
                    if (c.ok) return <span key={i} className="ok">{c.char}</span>
                    if (!c.typed) return <span key={i} className="miss">{c.char}</span>
                    return <span key={i} className="bad" title={`You sent ${c.typed}`}>{c.char}</span>
                  })}
                  {summary.extra && <span className="bad">{summary.extra}</span>}
                </div>
                <div className="summary-stats">
                  <div className="summary-stat"><div className="v gold">{summary.correct}/{summary.total}</div><div className="k">Characters</div></div>
                  <div className="summary-stat"><div className="v">{pct(summary.timingScore)}</div><div className="k">Timing</div></div>
                  <div className="summary-stat"><div className="v">{summary.elements}</div><div className="k">Elements</div></div>
                </div>
              </>
            )}

            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn primary" onClick={start}>
                <Play width={14} height={14} /> Key it again
              </button>
              <button type="button" className="btn ghost" onClick={() => setPhase('idle')}>
                Change settings
              </button>
            </div>
          </section>

          <aside className="practice-side">
            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 10 }}>What your hand said</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, wordBreak: 'break-all' }}>
                sent&nbsp;&nbsp; {summary.sent || '—'}<br />
                target {summary.target || '—'}
              </div>
              <hr className="divider" />
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                {summary.accuracy >= 0.9
                  ? 'Your spacing is doing the work. Keep this speed for another set before climbing.'
                  : 'Most send errors are spacing errors, not duration errors. Count the silence between letters.'}
              </p>
            </section>
            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 8 }}>Next</div>
              <button type="button" className="btn ghost sm" style={{ width: '100%', marginBottom: 8 }} onClick={() => { setMode('groups'); setPhase('idle') }}>
                <Target width={13} height={13} /> Send groups
              </button>
              <button type="button" className="btn ghost sm" style={{ width: '100%' }} onClick={() => { setMode('free'); setPhase('idle') }}>
                <KeyIcon width={13} height={13} /> Free key
              </button>
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
