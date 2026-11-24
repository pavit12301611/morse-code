import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { engine } from '../lib/audio'
import { MORSE, LETTERS, DIGITS, PUNCT, charName } from '../lib/morse'
import { buildDeck, isCorrect, TEST_SIZE } from '../lib/quiz'

const POOLS = [
  { id: 'letters', label: 'Letters', chars: LETTERS },
  { id: 'numbers', label: 'Numbers', chars: DIGITS },
  { id: 'punctuation', label: 'Punctuation', chars: PUNCT },
]

const CODE_SPEED = 20

export function Test() {
  const [activePools, setActivePools] = useState(['letters', 'numbers'])
  const [phase, setPhase] = useState('ready') // ready | question | answered | done
  const [deck, setDeck] = useState([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [results, setResults] = useState([])
  const [playing, setPlaying] = useState(false)

  const inputRef = useRef(null)
  const playToken = useRef(0)

  const pool = useMemo(() => {
    const chars = POOLS.filter((p) => activePools.includes(p.id)).flatMap((p) => p.chars)
    return [...new Set(chars)]
  }, [activePools])

  const current = deck[index] ?? null
  const total = deck.length
  const answered = results.length
  const right = results.filter((r) => r.correct).length
  const missed = results.filter((r) => !r.correct)
  const inTest = phase === 'question' || phase === 'answered'

  /* Configure once, and stop any tone when the screen goes away. */
  useEffect(() => {
    engine.configure({ freq: 620, volume: 0.45, wave: 'sine' })
    return () => engine.stop()
  }, [])

  /* Keep the answer box ready so the test is keyboard-only. */
  useEffect(() => {
    if (phase === 'question') inputRef.current?.focus()
  }, [phase, index])

  const play = useCallback((char) => {
    const code = MORSE[char]
    if (!code) return
    const token = playToken.current + 1
    playToken.current = token
    setPlaying(true)
    const handle = engine.play(code, { charWpm: CODE_SPEED, effWpm: CODE_SPEED })
    handle.promise.then(() => {
      if (playToken.current === token) setPlaying(false)
    })
  }, [])

  const start = useCallback(() => {
    const next = buildDeck(pool, TEST_SIZE)
    if (!next.length) return
    engine.ensure()
    playToken.current += 1
    setDeck(next)
    setIndex(0)
    setAnswer('')
    setResult(null)
    setResults([])
    setPhase('question')
    play(next[0])
  }, [play, pool])

  const check = useCallback(() => {
    if (phase !== 'question' || !current) return
    const correct = isCorrect(answer, current)
    setResult({ correct, given: answer.trim() })
    setResults((prev) => [...prev, { char: current, correct, given: answer.trim() }])
    setPhase('answered')
  }, [answer, current, phase])

  const next = useCallback(() => {
    if (phase !== 'answered') return
    const i = index + 1
    setAnswer('')
    setResult(null)
    if (i >= deck.length) {
      setPhase('done')
      return
    }
    setIndex(i)
    setPhase('question')
    play(deck[i])
  }, [deck, index, phase, play])

  const onSubmit = (e) => {
    e.preventDefault()
    if (phase === 'question') check()
    else if (phase === 'answered') next()
  }

  const togglePool = (id) => {
    setActivePools((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setPhase('ready')
    setDeck([])
    setResults([])
    setResult(null)
    setAnswer('')
    engine.stop()
  }

  const poolLine = activePools.length
    ? `${pool.length} characters in the pool`
    : 'Pick at least one set to start'

  return (
    <div className="test">
      <header className="page-head">
        <span className="eyebrow">Random listening test</span>
        <h1 className="h1">Hear it. Name it.</h1>
        <p className="lede">
          One character at a time, picked at random and sent in real CW timing. Type what you
          hear — every test is a fresh shuffle.
        </p>
      </header>

      <section className="card" aria-label="Morse test">
        {phase === 'ready' && (
          <>
            <div className="meta-row">
              <span>{TEST_SIZE} questions</span>
              <span>{poolLine}</span>
            </div>
            <div className="progress" aria-hidden="true">
              <i style={{ width: '0%' }} />
            </div>

            <div className="chips" role="group" aria-label="Character sets">
              {POOLS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${activePools.includes(p.id) ? 'on' : ''}`}
                  aria-pressed={activePools.includes(p.id)}
                  onClick={() => togglePool(p.id)}
                >
                  {p.label}
                  <span>{p.chars.length}</span>
                </button>
              ))}
            </div>

            <button type="button" className="btn primary block start" onClick={start} disabled={!pool.length}>
              Start the test
            </button>
            <p className="hint">Sound on · {CODE_SPEED} wpm · one character per question</p>
          </>
        )}

        {inTest && (
          <>
            <div className="meta-row">
              <span>
                Question <b>{index + 1}</b> of {total}
              </span>
              <span>
                <b className={right ? 'good-text' : ''}>{right}</b> correct
                {answered - right > 0 && <> · {answered - right} missed</>}
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={answered}
              aria-label="Test progress"
            >
              <i style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
            </div>

            <div className="listen">
              <button
                type="button"
                className={`play-btn ${playing ? 'playing' : ''}`}
                onClick={() => play(current)}
                aria-label="Play the character again"
              >
                <span className="wave" aria-hidden="true">
                  <i /><i /><i /><i /><i />
                </span>
              </button>
              <p className="listen-hint">{playing ? 'Sending…' : 'Play again'}</p>
            </div>

            <form className="answer-form" onSubmit={onSubmit}>
              <label className="label" htmlFor="answer">
                What did you hear?
              </label>
              <div className="answer-row">
                <input
                  id="answer"
                  ref={inputRef}
                  className="answer-input"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={1}
                  placeholder="?"
                  value={answer}
                  readOnly={phase === 'answered'}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                {phase === 'question' ? (
                  <button type="submit" className="btn primary" disabled={!answer.trim()}>
                    Check
                  </button>
                ) : (
                  <button type="button" className="btn primary" onClick={next} autoFocus>
                    {index + 1 >= total ? 'See results' : 'Next'}
                  </button>
                )}
              </div>
            </form>

            {phase === 'answered' && result && (
              <div className={`feedback ${result.correct ? 'good' : 'bad'}`} role="status">
                <div className="feedback-head">
                  <span className="feedback-char">{current}</span>
                  <span>{result.correct ? 'Correct' : 'Not quite'}</span>
                </div>
                <p className="feedback-body">
                  <span className="feedback-name">{charName(current)}</span>
                  <code className="pattern">{MORSE[current]}</code>
                  {result.correct ? (
                    <> — exactly right.</>
                  ) : result.given ? (
                    <> — you answered “{result.given.toUpperCase()}”.</>
                  ) : (
                    <> — you left it blank.</>
                  )}
                </p>
                <p className="feedback-note">Press Enter for the next character.</p>
              </div>
            )}
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="score-hero">
              <div className="score-num">
                {right}
                <span className="score-of">/{total}</span>
              </div>
              <div className="score-sub">
                {Math.round((right / Math.max(1, total)) * 100)}% correct ·{' '}
                {right === total ? 'a clean sweep' : `${total - right} to revisit`}
              </div>
            </div>

            {missed.length > 0 ? (
              <div className="missed">
                <span className="label">Missed characters</span>
                <div className="missed-list">
                  {missed.map((m, i) => (
                    <span className="missed-chip" key={`${m.char}-${i}`}>
                      <b>{m.char}</b>
                      <code>{MORSE[m.char]}</code>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="clean">No misses. Every character in this test was copied cleanly.</p>
            )}

            <div className="chips" role="group" aria-label="Character sets">
              {POOLS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${activePools.includes(p.id) ? 'on' : ''}`}
                  aria-pressed={activePools.includes(p.id)}
                  onClick={() => togglePool(p.id)}
                >
                  {p.label}
                  <span>{p.chars.length}</span>
                </button>
              ))}
            </div>

            <button type="button" className="btn primary block start" onClick={start} disabled={!pool.length}>
              New random test
            </button>
            <p className="hint">Reshuffles the pool — new characters, new order.</p>
          </>
        )}
      </section>
    </div>
  )
}
