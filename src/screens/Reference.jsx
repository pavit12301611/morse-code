import React, { useMemo, useState } from 'react'
import { useStore, knownChars } from '../lib/store'
import { MORSE, LETTERS, DIGITS, PUNCT, PROSIGNS, KOCH_ORDER, encode, rhythm } from '../lib/morse'
import { useCw } from '../hooks/useCw'
import { Pattern, Tip } from '../components/Ui'
import { Play, Pause, Search, Info, Volume, Wand } from '../components/Icons'

const TABS = [
  { id: 'letters', label: 'Letters' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'punct', label: 'Punctuation' },
  { id: 'prosigns', label: 'Prosigns' },
]

export function Reference() {
  const { progress, settings } = useStore()
  const known = knownChars(progress)
  const [tab, setTab] = useState('letters')
  const [query, setQuery] = useState('')
  const [hide, setHide] = useState(false)
  const [playingChar, setPlayingChar] = useState(null)
  const [alphabet, setAlphabet] = useState(false)
  const cw = useCw({ charWpm: settings.charWpm, effWpm: settings.charWpm })

  const play = (char, code) => {
    setAlphabet(false)
    if (playingChar === char) {
      cw.stop()
      setPlayingChar(null)
      return
    }
    setPlayingChar(char)
    cw.play(code, {
      charWpm: settings.charWpm,
      effWpm: settings.charWpm,
      onEnd: () => setPlayingChar(null),
    })
  }

  const playAlphabet = () => {
    setPlayingChar(null)
    if (alphabet) {
      cw.stop()
      setAlphabet(false)
      return
    }
    setAlphabet(true)
    cw.play(encode('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), {
      charWpm: settings.charWpm,
      effWpm: settings.charWpm,
      onEnd: () => setAlphabet(false),
    })
  }

  const items = useMemo(() => {
    let list
    if (tab === 'letters') list = LETTERS
    else if (tab === 'numbers') list = DIGITS
    else if (tab === 'punct') list = PUNCT
    else list = []
    const q = query.trim().toUpperCase()
    if (!q) return list
    return list.filter((c) => c.includes(q) || MORSE[c]?.includes(q.replace(/[^.-]/g, '')))
  }, [tab, query])

  return (
    <>
      <div className="screen-head">
        <div>
          <div className="eyebrow">Signal table</div>
          <h1 className="display">Every character,<br />one clean tone.</h1>
          <p className="lede">
            The full code, playable. Use it to check a pattern, settle an argument, or test
            yourself with the patterns covered.
          </p>
        </div>
        <div className="row" style={{ gap: 9 }}>
          <div className="speed-chip"><span className="dot" /><b>{settings.charWpm}</b> wpm</div>
          <button type="button" className={`btn ${hide ? 'gold-ghost' : 'ghost'}`} onClick={() => setHide((h) => !h)}>
            {hide ? 'Reveal patterns' : 'Cover patterns'}
          </button>
          <button type="button" className={`btn ${alphabet ? 'gold-ghost' : 'primary'}`} onClick={playAlphabet}>
            {alphabet ? <Pause width={14} height={14} /> : <Play width={14} height={14} />}
            {alphabet ? 'Stop' : 'Play A–Z'}
          </button>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18, gap: 14 }}>
        <div className="segmented" role="tablist" aria-label="Category">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'prosigns' && (
          <div style={{ position: 'relative', maxWidth: 280, width: '100%' }}>
            <Search width={15} height={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36, fontFamily: 'var(--mono)', fontSize: 12 }}
              placeholder="Find a character or pattern"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter characters"
            />
          </div>
        )}
      </div>

      {tab !== 'prosigns' && (
        <div className="ref-grid">
          {items.map((char) => {
            const code = MORSE[char]
            const active = playingChar === char
            const inSet = known.includes(char)
            return (
              <button
                key={char}
                type="button"
                className={`ref-card ${active ? 'playing' : ''} ${inSet ? 'in-curriculum' : ''}`}
                onClick={() => play(char, code)}
                title={`Play ${char} (${rhythm(code)})`}
              >
                <span className="c">
                  <span>{char === ' ' ? 'space' : char}</span>
                  <span className="play">{active ? <Pause width={13} height={13} /> : <Volume width={13} height={13} />}</span>
                </span>
                <span className="pattern" style={{ display: 'flex', minHeight: 8 }}>
                  {hide ? <span style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)' }}>· · ·</span> : <Pattern code={code} />}
                </span>
              </button>
            )
          })}
          {!items.length && <div className="empty" style={{ gridColumn: '1 / -1' }}>Nothing matches “{query}”. Try a character or a pattern like “-.-”.</div>}
        </div>
      )}

      {tab === 'prosigns' && (
        <div className="ref-grid">
          {PROSIGNS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`ref-card ref-prosign ${playingChar === p.label ? 'playing' : ''}`}
              onClick={() => play(p.label, p.code)}
            >
              <span className="c">
                <span>{p.label}</span>
                <span className="play">{playingChar === p.label ? <Pause width={13} height={13} /> : <Volume width={13} height={13} />}</span>
              </span>
              <span className="pattern" style={{ marginTop: 10 }}><Pattern code={p.code} /></span>
              <span className="meaning">{p.meaning}</span>
            </button>
          ))}
          <div className="card card-pad" style={{ gridColumn: 'span 2' }}>
            <div className="card-title" style={{ marginBottom: 8 }}>How prosigns work</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              A prosign is sent as one character — the elements run together without a letter gap.
              That is why AR (·—·—·) sounds different from the separate letters A and R.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
        <section className="card card-pad">
          <div className="card-head">
            <div className="card-title">Timing, in units</div>
            <span className="chip">PARIS</span>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {[
              { label: 'Dot', bars: [{ w: 18, on: true }], note: '1 unit of tone' },
              { label: 'Dash', bars: [{ w: 54, on: true }], note: '3 units of tone' },
              { label: 'Element gap', bars: [{ w: 18, on: false }], note: '1 unit of silence' },
              { label: 'Letter gap', bars: [{ w: 54, on: false }], note: '3 units of silence' },
              { label: 'Word gap', bars: [{ w: 126, on: false }], note: '7 units of silence' },
            ].map((row) => (
              <div key={row.label} className="between" style={{ gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', width: 92 }}>{row.label}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'block', width: row.w, height: 6, borderRadius: 3,
                    background: row.on ? 'var(--gold)' : 'transparent',
                    border: row.on ? 'none' : '1px dashed var(--line-strong)',
                  }} />
                </div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', width: 92, textAlign: 'right' }}>{row.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <div className="card-title">Reading a pattern</div>
            <Wand width={16} height={16} className="gold" />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
            Count the <b>sound</b>, not the symbols. “R” is a short-long-short — <i>di-dah-dit</i> —
            not “dot dash dot”. At 20 wpm the whole letter lasts about a fifth of a second, so the
            only thing that fits is the rhythm.
          </p>
          <hr className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {['.-', '-...', '-.-.', '...'].map((code, i) => (
              <button
                key={code}
                type="button"
                className="chip"
                onClick={() => play(['A', 'B', 'C', 'S'][i], code)}
                style={{ textTransform: 'none', letterSpacing: '0.06em' }}
              >
                {['A', 'B', 'C', 'S'][i]} <Pattern code={code} />
              </button>
            ))}
          </div>
          <div className="tip" style={{ marginTop: 16 }}>
            <Info width={15} height={15} />
            <div>The cards with a tiny gold dot are in your current curriculum. Everything else is fair game to preview.</div>
          </div>
        </section>
      </div>
    </>
  )
}
