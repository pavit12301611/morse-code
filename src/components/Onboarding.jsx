import React, { useState } from 'react'
import { Modal } from './Ui'
import { store } from '../lib/store'
import { Ear, Target, Wand, ArrowRight, Info } from './Icons'

const paths = [
  {
    id: 'new',
    title: 'Complete beginner',
    desc: 'Start with two letters and build by ear, the way it actually sticks.',
    icon: Ear,
    lesson: 1,
    effWpm: 10,
  },
  {
    id: 'some',
    title: 'Know the basics',
    desc: 'Jump in around lesson 8. Good for a refresher without the ABCs.',
    icon: Wand,
    lesson: 8,
    effWpm: 12,
  },
  {
    id: 'fast',
    title: 'I want speed',
    desc: 'Open the whole alphabet and go straight to copy drills.',
    icon: Target,
    lesson: 20,
    effWpm: 15,
  },
]

export function Onboarding({ onDone }) {
  const [path, setPath] = useState('new')
  const [charWpm, setCharWpm] = useState(20)
  const [effWpm, setEffWpm] = useState(10)

  const choose = (p) => {
    setPath(p.id)
    setEffWpm(Math.min(p.effWpm, charWpm))
  }

  const begin = () => {
    const p = paths.find((x) => x.id === path)
    store.update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        charWpm,
        effWpm: Math.min(effWpm, charWpm),
      },
      progress: {
        ...s.progress,
        onboarded: true,
        lesson: p.lesson,
      },
    }))
    onDone?.()
  }

  return (
    <Modal labelledBy="onboard-title">
      <div className="onboard-hero">
        <div className="onboard-glyph" aria-hidden="true">
          <i className="d" /><i className="h" /><i className="g" /><i className="h" /><i className="d" />
        </div>
        <div className="eyebrow plain" style={{ justifyContent: 'center' }}>Welcome to the signal station</div>
        <h2 id="onboard-title" className="h2" style={{ marginTop: 10 }}>Learn Morse by ear.</h2>
        <p className="dim" style={{ marginTop: 8, fontSize: 13.5, maxWidth: '42ch', marginInline: 'auto' }}>
          Real CW from the first minute — fast characters, generous spacing, no dot-and-dash memorisation.
        </p>
      </div>

      <div className="field-cap">Where are you now?</div>
      <div className="choice-grid" role="radiogroup" aria-label="Experience level">
        {paths.map((p) => {
          const Icon = p.icon
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={path === p.id}
              className={`choice ${path === p.id ? 'active' : ''}`}
              onClick={() => choose(p)}
            >
              <span className="ico"><Icon width={19} height={19} /></span>
              <span className="t">{p.title}</span>
              <span className="d">{p.desc}</span>
            </button>
          )
        })}
      </div>

      <hr className="divider" />

      <div className="setting-row" style={{ borderBottom: 0, paddingTop: 0 }}>
        <div>
          <div className="setting-label">Character speed</div>
          <div className="setting-sub">The speed each letter is sent. Keep this fast — 18–22 is ideal for a beginner.</div>
        </div>
        <div className="setting-control wide">
          <input
            type="range" min="12" max="30" step="1" value={charWpm}
            style={{ '--fill': `${((charWpm - 12) / 18) * 100}%` }}
            onChange={(e) => {
              const v = Number(e.target.value)
              setCharWpm(v)
              if (effWpm > v) setEffWpm(v)
            }}
            aria-label="Character speed in words per minute"
          />
          <span className="value-pill">{charWpm}<span>wpm</span></span>
        </div>
      </div>
      <div className="setting-row" style={{ borderBottom: 0 }}>
        <div>
          <div className="setting-label">Target copy speed</div>
          <div className="setting-sub">Effective speed. Gaps stretch so you can hear and decode comfortably.</div>
        </div>
        <div className="setting-control wide">
          <input
            type="range" min="5" max={charWpm} step="1" value={effWpm}
            style={{ '--fill': `${((effWpm - 5) / Math.max(1, charWpm - 5)) * 100}%` }}
            onChange={(e) => setEffWpm(Number(e.target.value))}
            aria-label="Effective speed in words per minute"
          />
          <span className="value-pill">{effWpm}<span>wpm</span></span>
        </div>
      </div>

      <div className="tip" style={{ marginTop: 8 }}>
        <Info width={16} height={16} />
        <div>You can change everything later. Your progress is stored on this device only.</div>
      </div>

      <button type="button" className="btn primary lg" style={{ width: '100%', marginTop: 18 }} onClick={begin}>
        Enter the studio <ArrowRight width={16} height={16} />
      </button>
      <button
        type="button"
        className="btn ghost sm"
        style={{ width: '100%', marginTop: 9, border: 0 }}
        onClick={() => {
          store.update((s) => ({ ...s, progress: { ...s.progress, onboarded: true } }))
          onDone?.()
        }}
      >
        I’ll look around first
      </button>
    </Modal>
  )
}
