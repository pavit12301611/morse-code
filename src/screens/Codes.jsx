import React from 'react'
import { MORSE, LETTERS, DIGITS, PUNCT, PROSIGNS, charName } from '../lib/morse'

const SECTIONS = [
  { id: 'letters', title: 'Letters', note: 'A–Z', chars: LETTERS },
  { id: 'numbers', title: 'Numbers', note: '0–9', chars: DIGITS },
  { id: 'punctuation', title: 'Punctuation & symbols', note: `${PUNCT.length} marks`, chars: PUNCT },
]

export function Codes() {
  return (
    <div className="codes">
      <header className="page-head">
        <span className="eyebrow">Reference sheet</span>
        <h1 className="h1">Every Morse code.</h1>
        <p className="lede">
          Letters, numbers, punctuation and the prosigns you hear on the air — all on one sheet.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section className="section" key={section.id}>
          <div className="section-head">
            <h2>{section.title}</h2>
            <span>{section.note}</span>
          </div>
          <ul className="code-grid">
            {section.chars.map((char) => (
              <li className="code-card" key={char}>
                <span className="code-char">{char}</span>
                <span className="code-name">{charName(char) === char ? '\u00a0' : charName(char)}</span>
                <code className="code-pattern">{MORSE[char]}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="section">
        <div className="section-head">
          <h2>Prosigns</h2>
          <span>operating shorthand</span>
        </div>
        <ul className="code-grid prosign-grid">
          {PROSIGNS.map((p) => (
            <li className="code-card prosign-card" key={p.label}>
              <span className="code-char small">{p.label}</span>
              <code className="code-pattern">{p.code}</code>
              <span className="prosign-meaning">{p.meaning}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="fineprint">
        A dash is three dits. Letter gaps are three dits, word gaps seven — the rhythm matters more
        than the marks.
      </p>
    </div>
  )
}
