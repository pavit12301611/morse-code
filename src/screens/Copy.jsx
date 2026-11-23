import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/appContext'
import { store, useStore, knownChars, bestCopySpeed } from '../lib/store'
import {
  encode, randomGroup, randomWord, randomFrom, COMMON_WORDS, CALLSIGNS, PLAIN_TEXT, QSO_LINES,
} from '../lib/morse'
import { useCw } from '../hooks/useCw'
import { Lamp, Tip } from '../components/Ui'
import { Play, Refresh, ArrowRight, Headphones, Info, Ear, Target, Check } from '../components/Icons'
import { pct, normalizeCopy } from '../lib/format'

const TYPES = [
  { id: 'group', label: 'Groups of 5', hint: 'Classic copy practice — random letters, five at a time.' },
  { id: 'word', label: 'Words', hint: 'Common English words, sent as one transmission.' },
  { id: 'call', label: 'Callsigns', hint: 'Amateur-radio callsigns, the way you meet them on air.' },
  { id: 'text', label: 'On-air lines', hint: 'A QSO-style line or plain sentence, copied from memory.' },
]

const STEPS = [10, 12, 15, 18, 22, 26, 30]

function usableList(list, chars) {
  return list.filter((item) => [...item].every((c) => c === ' ' || chars.includes(c)))
}

export function Copy() {
  const { progress, settings } = useStore()
  const { launchDrill } = useApp()
  const known = knownChars(progress)
  const best = bestCopySpeed(progress)

  const [type, setType] = useState('group')
  const [length, setLength] = useState(3)
  const [effWpm, setEffWpm] = useState(settings.effWpm)
  const charWpm = Math.max(settings.charWpm, effWpm)

  const [phase, setPhase] = useState('idle') // idle | transmitting | answering | checked
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [replays, setReplays] = useState(0)
  const [duration, setDuration] = useState(1)
  const [startedAt, setStartedAt] = useState(null)
  const inputRef = useRef(null)
  const startTimer = useRef(null)
  const cw = useCw({ charWpm, effWpm })

  useEffect(() => () => clearTimeout(startTimer.current), [])

  const wordsAvailable = useMemo(() => usableList(COMMON_WORDS, known).length, [known])
  const callsAvailable = useMemo(() => usableList(CALLSIGNS, known).length, [known])
  const textsAvailable = useMemo(() => usableList([...PLAIN_TEXT, ...QSO_LINES], known).length, [known])

  const available = { group: true, word: wordsAvailable > 0, call: callsAvailable > 0, text: textsAvailable > 0 }

  const expected = items.join(' ')
  const code = useMemo(() => items.map((i) => encode(i)).join(' / '), [items])

  const build = () => {
    if (type === 'group') return Array.from({ length }, () => randomGroup(known, 5))
    if (type === 'word') return Array.from({ length }, () => randomWord(known, COMMON_WORDS))
    if (type === 'call') return Array.from({ length: Math.min(length, 5) }, () => randomFrom(usableList(CALLSIGNS, known)))
    return [randomFrom(usableList([...PLAIN_TEXT, ...QSO_LINES], known))]
  }

  const begin = () => {
    if (!available[type]) return
    const next = build()
    setItems(next)
    setInput('')
    setResult(null)
    setReplays(0)
    setPhase('transmitting')
    setStartedAt(Date.now())
    const nextCode = next.map((i) => encode(i)).join(' / ')
    setPhase('arming')
    clearTimeout(startTimer.current)
    startTimer.current = setTimeout(() => {
      setPhase('transmitting')
      const handle = cw.play(nextCode, {
        charWpm,
        effWpm,
        onEnd: (res) => {
          if (!res?.stopped) {
            setPhase('answering')
            setTimeout(() => inputRef.current?.focus(), 120)
          }
        },
      })
      setDuration(Math.max(1, handle.timeline?.total || 1))
    }, 1100)
  }

  const replay = () => {
    const wasChecked = phase === 'checked'
    setReplays((r) => r + 1)
    const handle = cw.play(code, {
      charWpm,
      effWpm,
      onEnd: (res) => {
        if (!res?.stopped && !wasChecked) {
          setPhase('answering')
          setTimeout(() => inputRef.current?.focus(), 120)
        }
      },
    })
    setDuration(Math.max(1, handle.timeline?.total || 1))
  }

  const check = () => {
    if (!input.trim()) return
    const exp = normalizeCopy(expected)
    const typed = normalizeCopy(input)
    const compactTyped = typed.replace(/\s+/g, '')
    let k = 0
    let correct = 0
    let total = 0
    const perChar = [...exp].map((char) => {
      if (char === ' ') return { char, space: true }
      total += 1
      const got = compactTyped[k] || ''
      const ok = got === char
      if (ok) correct += 1
      k += 1
      return { char, typed: got, ok }
    })
    const extra = compactTyped.slice(total)
    const accuracy = total ? correct / total : 0
    const seconds = startedAt ? (Date.now() - startedAt) / 1000 : 0
    const copyWpm = duration > 0 ? Math.round((correct / 5) / (duration / 60)) : 0
    setResult({ perChar, correct, total, extra, accuracy, copyWpm, seconds })
    setPhase('checked')
    cw.stop()

    perChar.filter((c) => !c.space).forEach((c) => store.recordChar(c.char, !!c.ok, 0))
    store.recordSession({
      kind: 'copy',
      label: `${TYPES.find((t) => t.id === type).label} · ${effWpm} wpm`,
      items: total,
      correct,
      wpm: accuracy >= 0.9 && total > 10 ? effWpm : 0,
      durationMs: Math.max(1000, Date.now() - (startedAt || Date.now())),
    })
  }

  const progressPct = phase === 'transmitting' ? Math.min(100, (cw.elapsed / duration) * 100) : 0

  return (
    <>
      <div className="screen-head">
        <div>
          <div className="eyebrow">Head copy</div>
          <h1 className="display">Hold it in your <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>head</em>.</h1>
          <p className="lede">
            Copy the whole transmission in memory, then write it down. No pencil while listening —
            this is the skill that makes Morse useful on air.
          </p>
        </div>
        <div className="card card-pad" style={{ minWidth: 220 }}>
          <div className="card-cap">Personal best</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 30, marginTop: 6 }}>
            {best || '—'}<span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>wpm</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>copied at 90% or better</div>
        </div>
      </div>

      {phase === 'idle' && (
        <>
          <section className="card config-panel">
            <div className="config-group grow">
              <span className="field-cap">Transmission</span>
              <div className="segmented" role="group" aria-label="Content type">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={type === t.id ? 'active' : ''}
                    disabled={!available[t.id]}
                    onClick={() => setType(t.id)}
                    title={!available[t.id] ? 'Learn more characters to unlock this' : t.label}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{TYPES.find((t) => t.id === type).hint}</div>
            </div>

            {type !== 'text' && (
              <div className="config-group">
                <span className="field-cap">Length</span>
                <div className="segmented">
                  {[3, 5, 8].map((n) => (
                    <button key={n} type="button" className={length === n ? 'active' : ''} onClick={() => setLength(n)}>{n}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{type === 'call' ? 'callsigns' : type === 'word' ? 'words' : 'groups'}</div>
              </div>
            )}

            <div className="config-group grow">
              <span className="field-cap">Copy speed · effective</span>
              <div className="speed-ladder">
                {STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    className={`ladder-step ${effWpm === step ? 'active' : ''} ${best >= step ? 'passed' : ''}`}
                    disabled={step > charWpm}
                    onClick={() => setEffWpm(step)}
                    title={step > charWpm ? 'Raise character speed first' : `${step} wpm effective`}
                  >
                    {step}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Letters at {charWpm} wpm · gaps stretched to {effWpm} wpm
              </div>
            </div>

            <button type="button" className="btn primary lg" onClick={begin} disabled={!available[type]}>
              <Headphones width={16} height={16} /> Transmit
            </button>
          </section>

          <div className="dash-grid">
            <section className="card card-pad">
              <div className="card-head">
                <div>
                  <div className="card-title">How to actually copy in your head</div>
                  <div className="card-cap" style={{ marginTop: 4 }}>Three habits</div>
                </div>
                <Ear width={16} height={16} className="gold" />
              </div>
              <div className="plan-item">
                <div className="plan-num">01</div>
                <div className="plan-body">
                  <div className="plan-title">Don’t translate every letter</div>
                  <div className="plan-sub">Let groups stack up as sound-shapes. You can hold five characters without naming them.</div>
                </div>
              </div>
              <div className="plan-item">
                <div className="plan-num">02</div>
                <div className="plan-body">
                  <div className="plan-title">Keep a rhythm in the gap</div>
                  <div className="plan-sub">Use the silence between groups to “set” the last one, not to panic about the next.</div>
                </div>
              </div>
              <div className="plan-item">
                <div className="plan-num">03</div>
                <div className="plan-body">
                  <div className="plan-title">Drop a letter, not the group</div>
                  <div className="plan-sub">If one character vanishes, write a dash and keep going. Flow matters more than perfection.</div>
                </div>
              </div>
              <div className="tip" style={{ marginTop: 16 }}>
                <Info width={16} height={16} />
                <div><b>Tip:</b> if you can’t copy a single character at this speed, lower spacing — but keep the letters fast. Slow letters teach bad habits.</div>
              </div>
            </section>

            <section className="card card-pad">
              <div className="card-head">
                <div className="card-title">Speed ladder</div>
                <span className="chip">Effective WPM</span>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {STEPS.map((step) => (
                  <div key={step} className="between" style={{ fontSize: 12 }}>
                    <span className="mono" style={{ color: step <= effWpm ? 'var(--text)' : 'var(--muted)' }}>{step} wpm</span>
                    {best >= step ? (
                      <span className="chip mint"><Check width={11} height={11} /> passed</span>
                    ) : step === effWpm ? (
                      <span className="chip gold">current</span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>—</span>
                    )}
                  </div>
                ))}
              </div>
              <hr className="divider" />
              <button type="button" className="btn ghost sm" style={{ width: '100%' }} onClick={() => launchDrill({ source: 'known', chars: known, mode: 'group', count: 20 })}>
                Warm up with a drill <ArrowRight width={13} height={13} />
              </button>
            </section>
          </div>
        </>
      )}

      {phase !== 'idle' && (
        <div className="practice-layout">
          <section className="card practice-main">
            <div className="stage" style={{ minHeight: 430 }}>
              <div className="stage-top">
                <div>
                  <div className="stage-count">
                    {phase === 'arming' ? 'Standing by' : phase === 'transmitting' ? 'Receiving transmission' : phase === 'answering' ? 'Now write it down' : 'Copy check'}
                  </div>
                  {phase === 'transmitting' && (
                    <div className="stage-progress"><i style={{ width: `${progressPct}%` }} /></div>
                  )}
                </div>
                <span className="chip">{charWpm}/{effWpm} wpm</span>
              </div>

              <Lamp on={cw.tone} big />
              <div className="hint-line" aria-live="polite">
                {phase === 'arming'
                  ? `Get ready — ${items.length} ${type === 'text' ? 'line' : items.length === 1 ? 'item' : 'items'} at ${effWpm} wpm`
                  : phase === 'transmitting'
                  ? `${items.length} ${type === 'text' ? 'line' : items.length === 1 ? 'item' : 'items'} · hold the whole thing in memory`
                  : phase === 'answering'
                    ? 'Type what you copied, in order'
                    : 'Compare your copy with what was sent'}
              </div>

              {phase === 'answering' && (
                <>
                  <form
                    className="answer-zone"
                    onSubmit={(e) => { e.preventDefault(); check() }}
                  >
                    <label className="sr-only" htmlFor="copy-answer">Your copy</label>
                    <input
                      id="copy-answer"
                      ref={inputRef}
                      className="answer-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value.toUpperCase())}
                      placeholder="WHAT YOU COPIED"
                      autoComplete="off"
                      spellCheck="false"
                      autoCapitalize="characters"
                    />
                  </form>
                  <div className="stage-actions">
                    <button type="button" className="btn primary" onClick={check} disabled={!input.trim()}>
                      Check copy <ArrowRight width={14} height={14} />
                    </button>
                    <button type="button" className="btn ghost" onClick={replay} disabled={cw.playing}>
                      <Refresh width={14} height={14} /> Replay
                    </button>
                    <button type="button" className="btn ghost" onClick={() => { cw.stop(); setPhase('idle') }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {phase === 'arming' && (
                <div className="stage-actions">
                  <button type="button" className="btn ghost" onClick={() => { clearTimeout(startTimer.current); setPhase('idle') }}>
                    Cancel
                  </button>
                </div>
              )}

              {phase === 'transmitting' && (
                <div className="stage-actions">
                  <button type="button" className="btn ghost" onClick={() => { cw.stop(); setPhase('answering'); setTimeout(() => inputRef.current?.focus(), 120) }}>
                    I’ve got it — write now
                  </button>
                  <button type="button" className="btn ghost" onClick={() => { cw.stop(); setPhase('idle') }}>
                    Cancel
                  </button>
                </div>
              )}

              {phase === 'checked' && result && (
                <div style={{ width: '100%', maxWidth: 640, marginTop: 8 }}>
                  <div className="copy-diff" aria-label="Copy comparison">
                    {result.perChar.map((c, i) => {
                      if (c.space) return <span key={i} className="word-gap" />
                      if (c.ok) return <span key={i} className="ok">{c.char}</span>
                      if (!c.typed) return <span key={i} className="miss">{c.char}</span>
                      return <span key={i} className="bad" title={`You wrote ${c.typed || 'nothing'}`}>{c.char}</span>
                    })}
                    {result.extra && <span className="bad" title="Extra characters">{result.extra}</span>}
                  </div>
                  <div role="status" className="feedback-strip" style={{ marginTop: 14 }}>
                    <span className={`chip ${result.accuracy >= 0.9 ? 'mint' : result.accuracy >= 0.7 ? 'gold' : 'red'}`}>
                      {pct(result.accuracy)} characters
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {result.correct} of {result.total} · {result.copyWpm} wpm actual copy rate
                    </span>
                    {replays > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {replays} replay{replays > 1 ? 's' : ''}</span>}
                  </div>
                  <div className="stage-actions">
                    <button type="button" className="btn primary" onClick={begin}>
                      <Play width={14} height={14} /> New transmission
                    </button>
                    <button type="button" className="btn" onClick={replay}>
                      <Refresh width={14} height={14} /> Hear this one again
                    </button>
                    {result.accuracy >= 0.95 && effWpm < Math.min(30, charWpm) && (
                      <button
                        type="button"
                        className="btn gold-ghost"
                        onClick={() => {
                          const next = STEPS.find((s) => s > effWpm) || effWpm
                          setEffWpm(next)
                          store.setSettings({ effWpm: next })
                          setPhase('idle')
                        }}
                      >
                        Step up to {STEPS.find((s) => s > effWpm) || effWpm} wpm <ArrowRight width={13} height={13} />
                      </button>
                    )}
                    <button type="button" className="btn ghost" onClick={() => { setPhase('idle'); setItems([]) }}>
                      Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="practice-side">
            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 10 }}>Transmission</div>
              <div className="between" style={{ fontSize: 12, color: 'var(--muted)' }}>
                <span>Content</span><span className="mono" style={{ color: 'var(--text-2)' }}>{TYPES.find((t) => t.id === type).label}</span>
              </div>
              <div className="between" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                <span>Items</span><span className="mono" style={{ color: 'var(--text-2)' }}>{items.length}</span>
              </div>
              <div className="between" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                <span>Letters at</span><span className="mono" style={{ color: 'var(--text-2)' }}>{charWpm} wpm</span>
              </div>
              <div className="between" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                <span>Gaps</span><span className="mono" style={{ color: 'var(--text-2)' }}>{effWpm} wpm</span>
              </div>
              <hr className="divider" />
              <div className="tip">
                <Info width={15} height={15} />
                <div>{phase === 'arming' ? 'Hands off the keys. The transmission starts in a moment.' : phase === 'transmitting' ? 'Don’t type yet. Just listen and let the pattern stack.' : 'Write in one pass. Correct in your head, not on the way.'}</div>
              </div>
            </section>

            <section className="card side-card">
              <div className="card-title" style={{ marginBottom: 10 }}>In this copy</div>
              {items.length ? (
                <div className="copy-group">
                  {items.map((item, i) => (
                    <span key={i} className="word" style={{ fontSize: 14, letterSpacing: '0.1em', padding: '2px 4px' }}>
                      {phase === 'checked' || phase === 'answering' ? item : '· · ·'}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="empty">No transmission yet.</div>
              )}
              {phase === 'checked' && (
                <button type="button" className="btn ghost sm" style={{ width: '100%', marginTop: 12 }} onClick={() => setPhase('idle')}>
                  <Target width={13} height={13} /> Change settings
                </button>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
